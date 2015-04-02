#!/usr/bin/env node

/**
 * Copyright (c) 2014 "Fronteer LTD"
 * Grasshopper Event Engine
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
 * This script will read in courses, subjects, parts, modules, series and events from a CSV file as
 * outputted by the `django-export-csv-command`. It will then build up a basic tree that can be
 * ingested into the system
 */

var _ = require('lodash');
var csv = require('csv');
var fs = require('fs');
var moment = require('moment');
var yargs = require('yargs');

var FullPattern = require('./pattern/fullpattern').FullPattern;
var PatternConstants = require('./pattern/constants');

var argv = yargs
    .usage('Convert a timetable-django CSV export into a an organisational unit tree.\nUsage: $0')
    .example('$0 --input events.csv --output tree.json', 'Convert events.csv into tree.json')
    .demand('i')
    .alias('i', 'input')
    .describe('i', 'The path where the CSV file can be read')
    .demand('o')
    .alias('o', 'output')
    .describe('o', 'The path where the JSON file should be written to')
    .demand('f')
    .alias('f', 'from')
    .describe('f', 'The academical year the CSV data is in')
    .demand('t')
    .alias('t', 'to')
    .describe('t', 'The academical year the dates should be outputted in')
    .argv;

var FROM = argv.from;
var TO = argv.to;

// Parse the CSV file
var options = {
    'columns': ['TriposId', 'TriposName', 'PartId', 'PartName', 'SubPartId', 'SubPartName', 'ModuleId', 'ModuleName', 'SerieId', 'SerieName', 'EventId', 'EventTitle', 'EventType', 'EventStartDateTime', 'EventEndDateTime']
};
var parser = csv.parse(options, function(err, output) {
    // Shift out the headers
    output.shift();

    // Generate the entire tree
    var tree = generateTree(output);

    // Make another pass and merge subjects
    // Iterate over the tree
    mergeSubjects(tree);

    // Write the tree to disk
    writeTree(tree);

    // Print it to standard out
    printTree(tree);
});

// Pipe the CSV file to the parser
var inputStream = fs.createReadStream(argv.input);
inputStream.pipe(parser);

var mergeSubjects = function(tree) {
    _.each(tree.nodes, function(course, courseId) {
        var subjectNodes = _.find(course.nodes, function(subjectOrPart) {
            return (subjectOrPart.type === 'subject');
        });
        var hasSubjects = (subjectNodes !== undefined);

        if (hasSubjects) {

            // Merge the subjects
            var subjectsByName = {};
            _.each(course.nodes, function(subject, subjectId) {
                subjectsByName[subject.name] = subjectsByName[subject.name] || [];
                subjectsByName[subject.name].push(subject);
            });

            course.nodes = {};
            _.each(subjectsByName, function(subjects, subjectName) {
                course.nodes[subjectName] = {
                    'id': subjectName,
                    'type': 'subject',
                    'name': subjectName,
                    'nodes': {}
                };

                _.each(subjects, function(subject) {
                    _.each(subject.nodes, function(node, nodeId) {
                        course.nodes[subjectName].nodes[nodeId] = node;
                    });
                });
            });
        }
    });
};

/**
 * Given an array of courses, modules, parts, subjects and events,
 * generate an organizational unit tree
 */
var generateTree = function(output) {
    var tree = {
        'name': 'Timetable',
        'type': 'root',
        'nodes': {}
    };

    var prevCourse = null;
    var prevSubject = null;
    var prevPart = null;
    var partCounter = 0;

    output.forEach(function(item) {
        tree.nodes[item.TriposId] = tree.nodes[item.TriposId] || {
            'id': item.TriposId,
            'name': item.TriposName,
            'type': 'course',
            'nodes': {}
        };

        var node = tree.nodes[item.TriposId];

        // A subpart maps to a subject, but is not always present
        if (item.SubPartId && item.SubPartName) {
            tree.nodes[item.TriposId].nodes[item.SubPartId] = tree.nodes[item.TriposId].nodes[item.SubPartId] || {
                'id': item.SubPartId,
                'name': item.SubPartName,
                'type': 'subject',
                'nodes': {}
            };
            node = tree.nodes[item.TriposId].nodes[item.SubPartId];
        }

        /*
         * The next bit is somewhat tricky. In the old stack the tree looks like this:
         * Course
         *    Part
         *       Subject
         *          Module
         *
         * We'd like our tree to be formatted like this:
         * Course
         *     Subject
         *        Part
         *           Module
         *
         * This means that we cannot simply use PartId as the identifier of our part
         * or we would be re-using it for all our subjects.
         */
        var part = _.find(_.values(node.nodes), {'name': item.PartName});
        var partId = null;
        if (!part) {
            partCounter++;
            partId = item.PartId + '-' + partCounter;
            node.nodes[partId] = {
                'id': partId,
                'name': item.PartName,
                'type': 'part',
                'nodes': {}
            };
        } else {
            partId = part.id;
        }

        // Module
        node.nodes[partId].nodes[item.ModuleId] = node.nodes[partId].nodes[item.ModuleId] || {
            'id': item.ModuleId,
            'name': item.ModuleName,
            'type': 'module',
            'nodes': {}
        };

        // Serie
        node.nodes[partId].nodes[item.ModuleId].nodes[item.SerieId] = node.nodes[partId].nodes[item.ModuleId].nodes[item.SerieId] || {
            'id': item.SerieId,
            'name': item.SerieName,
            'type': 'series',
            'nodes': {}
        };

        // Event
        node.nodes[partId].nodes[item.ModuleId].nodes[item.SerieId].nodes[item.EventId] = node.nodes[partId].nodes[item.ModuleId].nodes[item.SerieId].nodes[item.EventId] || {
            'id': item.EventId,
            'name': item.EventTitle,
            'type': 'event',
            'event-type': item.EventType,
            'start': convertTimestamp(item.EventStartDateTime),
            'end': convertTimestamp(item.EventEndDateTime)
        };

        prevCourse = item.TriposId;
        prevSubject = item.SubPartId;
        prevPart = partId;
    });

    return tree;
};

/*
 * Write a tree to a file
 */
var writeTree = function(tree) {
    fs.writeFile(argv.output, JSON.stringify(tree, null, 4), function(err) {
        if (err) {
            console.log('Could not save tree');
        }
    });
};

/*
 * Print the tree to the console
 */
var printTree = function(tree) {
    printNode(tree);
};

/*
 * Print a node (and all its child nodes) to stdout
 */
var printNode = function(node, level) {
    if (node.type === 'event') {
        return;
    }
    level = level || 0;

    var spaces = '';
    for (var i = 0; i < level * 3; i++) {
        spaces += ' ';
    }

    var extra = '';
    if (node.type === 'series') {
        // We generate a pattern that allows us to quickly verify whether
        // the converted timestamps are correctly rolled over
        var fp = new FullPattern();
        _.each(node.nodes, function(node, nodeId) {
            fp.add(node);
        });
        extra = ' ' + fp.toString();
    }

    console.log('%s%s (%s)%s', spaces, node.name, node.type[0], extra);
    _.each(node.nodes, function(node, nodeId) {
        printNode(node, level + 1);
    });
};

/**
 * Roll a timestamp over to the next academic year
 *
 * This function will determine on what day of what week of which term a timestamp falls and
 * use that information to return a timestamp that happens on the same day of the same week
 * of the same term.
 *
 * @param  {String}     timestamp   A timestamp to roll over
 * @return {String}                 The rolled over timestamp
 * @api private
 */
var convertTimestamp = function(timestamp) {
    // Convert the timestamp to a momentjs instance as it's easier to work with
    timestamp = moment(timestamp);

    // Try to figure out which term the timestamp belongs to
    var termIndex = getTerm(timestamp);
    var termStart = moment(PatternConstants.TERM_DATES[FROM][termIndex]);

    // Determine in which week this event took place and what day
    var dayOfWeek = timestamp.isoWeekday(); // 1 = Monday, 7 = Sunday

    // The dates in the constants start on a Tuesday, but a term "week" really starts on a Thursday
    var actualStartOfTerm = termStart.add(2, 'day');
    var days = timestamp.diff(actualStartOfTerm, 'day');

    // Determine in what week the event falls:
    // If a term starts on Tues the 7th of Oct
    //  - Week 0 = 7th and 8th of Oct
    //  - Week 1 = Thurs 9th till 15th
    var weeks = Math.floor(days / 7);

    // Start with the start date of the term the timestamp belongs to
    var newTimestamp = moment(PatternConstants.TERM_DATES[TO][termIndex]);

    // Make up for weeks starting on a Thursday
    newTimestamp.add(2, 'day');

    // Add the necessary amount of weeks
    newTimestamp.add(weeks, 'week');

    // Ensure the event is hold on the same day. We can't simply use isoWeekday as Cambridge
    // has to start the week on a Thursday
    var offset = ((dayOfWeek - actualStartOfTerm.isoWeekday()) + 7) % 7;
    newTimestamp.add(offset, 'day');

    // Simply copy the time information
    newTimestamp.hours(timestamp.hours());
    newTimestamp.minutes(timestamp.minutes());
    newTimestamp.seconds(timestamp.seconds());

    // Return the new timestamp
    return newTimestamp.format();
};

/**
 * Given a timestamp, get the term under which it falls
 *
 * @param  {Moment}     timestamp       The timestamp for which to get the term
 * @return {Number}                     0=Michaelmas, 1=Lent, 2=Easter
 * @api private
 */
var getTerm = function(timestamp) {
    var t1Offset = timestamp.diff(PatternConstants.TERM_DATES[FROM][0], 'week');
    var t2Offset = timestamp.diff(PatternConstants.TERM_DATES[FROM][1], 'week');
    var t3Offset = timestamp.diff(PatternConstants.TERM_DATES[FROM][2], 'week');

    if (t3Offset > 0) {
        return 2;
    } else if (t2Offset > 0) {
        return 1;
    } else {
        return 0;
    }
};
