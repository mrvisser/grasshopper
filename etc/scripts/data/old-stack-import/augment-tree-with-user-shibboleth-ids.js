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

var _ = require('lodash');
var csv = require('csv');
var fs = require('fs');
var jarowinkler = require('jaro-winkler');
var yargs = require('yargs');

var argv = yargs
    .usage('Augment the event organisers with their shibboleth ids.\nUsage: $0')
    .example('$0 --input tree.json --output tree-with-shibboleth-ids.json --users users.csv')
    .demand('i')
    .alias('i', 'input')
    .describe('i', 'The path where the JSON tree can be read')
    .demand('o')
    .alias('o', 'output')
    .describe('o', 'The path where the augmented JSON tree should be written to')
    .demand('u')
    .alias('u', 'users')
    .describe('u', 'The CSV file containing all the users. The expected columns are: dn, uid, cn, displayName, mail')
    .argv;

var matched = {};

var visittedEvents = 0;

var visitNode = function(node, users, tree) {
    if (node.type === 'event') {
        _.each(node.people, function(organiser, index) {
            var match = findMatch(organiser, users);
            if (match) {
                node.people[index] = {
                    'shibbolethId': match.uid + '@cam.ac.uk',
                    'displayName': match.displayName,
                    'original': organiser
                };
            }
        });
        visittedEvents++;
        if (visittedEvents % 25 === 0) {
            console.log('Handled %d events', visittedEvents);

            // Periodically write the tree to disk
            writeTree(tree);
        }
    } else {
        _.each(node.nodes, function(child) {
            visitNode(child, users, tree);
        });
    }
};

var writeTree = function(tree) {
    console.log('Flushing tree to disk');
    fs.writeFileSync(argv.output, JSON.stringify(tree, null, 4));
    console.log('Flushed tree to disk');
};

var findMatch = function(name, users) {
    var bestMatch = [];
    var max = 100000;

    if (matched[name]) {
        console.log('Got a match already');
        return matched[name];
    }

    var preppedName = prep(name);

    _.each(users, function(record) {
        var displayName = prep(record.displayName);
        var cn = prep(record.cn);
        var d = 0;

        if (displayName) {
            d = distance(preppedName, displayName);
            if (d < max) {
                max = d;
                bestMatch = [record];
                sameMatches = 0;
            } else if (d == max) {
                bestMatch.push(record);
            }
        }

        if (cn) {
            d = distance(preppedName, cn);
            if (d < max) {
                max = d;
                bestMatch = [record];
                sameMatches = 0;
            } else if (d == max) {
                bestMatch.push(record);
            }
        }
    });

    if (bestMatch.length === 1) {
        matched[name] = bestMatch[0];
        return matched[name];
    }

    return null;
};

var getTree = function(callback) {
    console.log('Reading tree');
    fs.readFile(argv.input, function(err, tree) {
        if (err) {
            console.log('Failed to read input tree');
            console.log(err);
            process.exit(1);
        }

        // Parse the tree
        console.log('Parsing tree');
        tree = JSON.parse(tree);
        console.log('Parsed tree');
        return callback(tree);
    });
};

var getUsersFromCSV = function(callback) {
    console.log('Parsing CSV file');
    var parser = csv.parse({'columns': ['dn', 'uid', 'cn', 'displayName', 'mail']}, function(err, records) {
        if (err) {
            console.log('Failed to parse CSV file');
            console.log(err);
            process.exit(1);
        }

        // Shift off the headers
        records.shift();
        console.log('Parsed CSV file');

        return callback(records);
    });

    var input = fs.createReadStream(argv.users);
    input.pipe(parser);
};

var prep = function(s) {
    s = s.trim();
    return s.replace(/(Dr\.)|(Prof\.?)|(Professor)/, '');
};

var distance = function(s1, s2) {
    return jarowinkler(s1, s2) * -1;
};

// Read the input tree
getTree(function(tree) {

    // Parse the CSV file
    getUsersFromCSV(function(users) {

        // Start processing nodes
        visitNode(tree, users, tree);
    });
});

