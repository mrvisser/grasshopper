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
var fs = require('fs');
var yargs = require('yargs');

var AdminsDAO = require('gh-admins/lib/internal/dao');
var AppsAPI = require('gh-apps');
var Context = require('gh-context').Context;
var EventsAPI = require('gh-events');
var GrassHopper = require('gh-core/lib/api');
var log = require('gh-core/lib/logger').logger('scripts/orgunit-import');
var OrgUnitAPI = require('gh-orgunit');
var UsersDAO = require('gh-users/lib/internal/dao');
var SeriesAPI = require('gh-series');

var config = require('../../../config');

/*
 * This script allows you to import a tree of courses, subjects,
 * parts, modules, series and events.
 *
 * This script will do a straight import. It will not attempt any disambiguation or linking with
 * existing courses, subjects, parts, modules, series or events.
 *
 * The tree should be formatted in the following manner:
 *
 * ```json
 * {
    "name": "Timetable",
    "type": "root",
    "nodes": {
        "5": {
            "id": "5",
            "name": "Natural Sciences Tripos",
            "type": "course",
            "nodes": {
                "117": {
                    "id": "117",
                    "name": "Biology of Cells",
                    "type": "subject",
                    "nodes": {
                        "106-31": {
                            "id": "106-31",
                            "name": "Part IA",
                            "type": "part",
                            "nodes": {
                                "487": {
                                    "id": "487",
                                    "name": "Practicals",
                                    "type": "module"
                                },
                                "488": {
                                    "id": "488",
                                    "name": "Lectures",
                                    "type": "module",
                                    "nodes": {
                                        "5875": {
                                            "id": "5875",
                                            "name": "Practicals - Monday Group",
                                            "type": "series",
                                            "nodes": {
                                                "49794": {
                                                    "id": "49794",
                                                    "name": "PCR",
                                                    "type": "event",
                                                    "location": "Lecture Room 1",
                                                    "event-type": "practical",
                                                    "start": "2015-02-23T11:00:00+00:00",
                                                    "end": "2015-02-23T17:00:00+00:00"
                                                },
    ...

 * ```
 */

var argv = yargs
    .usage('Import an organizational unit tree.\nUsage: $0')
    .example('$0 --file tree.json --app 19', 'Import the structure in tree.json for application 19')
    .demand('f')
    .alias('f', 'file')
    .describe('f', 'The JSON file that contains the tree')
    .demand('a')
    .alias('a', 'app')
    .describe('a', 'The id of the application for which the tree should be imported')

    .argv;

// Initialize the app server
GrassHopper.init(config, function(err) {
    if (err) {
        log().error({'err': err}, 'Failed to spin up the application container');
        process.exit(1);
    }

    // Get a global administrator
    AdminsDAO.getGlobalAdminByUsername('administrator', function(err, globalAdmin) {
        if (err) {
            log().error({'err': err}, 'Failed to get the global administrator');
            process.exit(1);
        }

        // Get the app
        var ctx = new Context(null, globalAdmin);
        AppsAPI.getApp(ctx, argv.app, function(err, app) {
            if (err) {
                log().error({'err': err}, 'Failed to get the provided app');
                process.exit(1);
            }

            ctx = new Context(app, globalAdmin);

            log().debug({'file': argv.file}, 'Reading file');
            fs.readFile(argv.file, function(err, tree) {
                if (err) {
                    log().error({'err': err, 'file': argv.file}, 'Failed to read file');
                    process.exit(1);
                }

                // Parse the tree
                log().debug('Parsing tree');
                tree = JSON.parse(tree);

                // Persist it
                log().info('Starting to persist the organizational tree, this is going to take a while');
                var courses = _.values(tree.nodes);
                createNodes(ctx, courses, null, function() {

                    // All done, simply exit
                    log().info('The organizational tree has been successfully imported');
                    process.exit(0);
                });
            });
        });
    });
});

/**
 * Recursively create the organizational units for a set of nodes.
 *
 * @param  {Context}            ctx                 Standard context containing the current user and the current app
 * @param  {Node[]}             nodes               A set of nodes to create
 * @param  {OrgUnit|Serie}      [parent]            The parent under which the nodes should be created
 * @param  {Function}           callback            Standard callback function
 */
var createNodes = function(ctx, nodes, parent, callback) {
    if (_.isEmpty(nodes)) {
        return callback();
    }

    // Create the node
    var node = nodes.pop();
    createNode(ctx, node, parent, function(createdItem) {
        // Create the child nodes, if any
        var childNodes = _.values(node.nodes);
        createNodes(ctx, childNodes, createdItem, function() {

            // All child nodes have been created, proceed
            // to the next sibling node, if any
            return createNodes(ctx, nodes, parent, callback);
        });
    });
};

/**
 * Create an organizational unit
 *
 * @param  {Context}            ctx             Standard context containing the current user and the current app
 * @param  {Node}               node            The node to create
 * @param  {OrgUnit|Serie}      [parent]        The parent under which the node should be created
 * @param  {Function}           callback        Standard callback function
 */
var createNode = function(ctx, node, parent, callback) {
    if (node.type === 'course' || node.type === 'subject' || node.type === 'part' || node.type === 'module') {
        createOrgUnit(ctx, node, parent, callback);
    } else if (node.type === 'series') {
        createSeries(ctx, node, parent, callback);
    } else if (node.type === 'event') {
        createEvent(ctx, node, parent, callback);
    }
};

/**
 * Create an organisational unit
 *
 * @param  {Context}    ctx             Standard context object containing the current user and the current application
 * @param  {Node}       node            The node to create
 * @param  {OrgUnit}    parent          The parent under which the organisational unit should be created
 * @param  {Function}   callback        Standard callback function
 */
var createOrgUnit = function(ctx, node, parent, callback) {
    var parentId = null;
    if (parent) {
        parentId = parent.id;
    }

    // Re-use the group id of the part if we're creating a module
    var groupId = null;
    if (node.type === 'module') {
        groupId = parent.GroupId;
    }
    OrgUnitAPI.createOrgUnit(ctx, argv.app, node.name.substring(0, 255), node.type, null, null, null, groupId, parentId, function(err, orgunit) {
        if (err) {
            log().error({'err': err, 'name': node.name}, 'Failed to create organisational unit');
            process.exit(1);
        }

        return callback(orgunit);
    });
};

/**
 * Create a series
 *
 * @param  {Context}    ctx             Standard context object containing the current user and the current application
 * @param  {Node}       node            The node to create
 * @param  {OrgUnit}    parent          The organisational unit under which the series should be created
 * @param  {Function}   callback        Standard callback function
 */
var createSeries = function(ctx, node, parent, callback) {
    SeriesAPI.createSerie(ctx, argv.app, node.name.substring(0, 255), null, parent.GroupId, function(err, serie) {
        if (err) {
            log().error({'err': err, 'name': node.name}, 'Failed to create series');
            process.exit(1);
        }

        parent.addSeries(serie).complete(function(err) {
            if (err) {
                log().error({'err': err, 'name': node.name}, 'Failed to add series to organisational unit');
                process.exit(1);
            }

            return callback(serie);
        });
    });
};

/**
 * Create an event
 *
 * @param  {Context}    ctx             Standard context object containing the current user and the current application
 * @param  {Node}       node            The node to create
 * @param  {Serie}      parent          The serie under which the event should be created
 * @param  {Function}   callback        Standard callback function
 */
var createEvent = function(ctx, node, parent, callback) {
    // TT's data isn't always correct
    var start = node.start;
    var end = node.end;
    if (start > end) {
        start = node.end;
        end = node.start;
        log().warn({'node': node}, 'Impossible start/end dates');
    }
    var opts = {
        'group': parent.GroupId,
        'series': [parent.id],
        'location': node.location,
        'organiserOther': []
    };

    // Split the organisers in two sets. One for plain-text organisers, one for linked by shib ids
    var organisers = _.partition(node.people, function(person) {
        return _.isString(person);
    });
    if (!_.isEmpty(organisers[0])) {
        opts.organiserOther = _.compact(organisers[0]);
    }

    var shibbolethIds = _.map(organisers[1], function(organiser) {
        return organiser.shibbolethId;
    });

    // Get the linked users
    UsersDAO.getUsersByShibbolethId(argv.app, shibbolethIds, function(err, users) {
        if (err) {
            log().error({'err': err, 'name': node.name}, 'Failed to get users by their shibboleth id');
            process.exit(1);
        } else if (users.length !== shibbolethIds.length) {
            log().warn({'organisers': shibbolethIds}, 'Could not find all users by their shibboleth id');

            // Fall back to the displayName for those users that could not be found. If the import
            // user script ran successfully, this should not happen though
            _.each(organisers[1], function(organiser) {
                var user = _.find(users, function(user) {
                    return (user.shibbolethId === organiser.shibbolethId);
                });
                if (!user) {
                    opts.organiserOther.push(organiser.displayName);
                }
            });
        }

        opts.organiserUsers = _.map(users, function(user) {
            return user.id;
        });

        // Create the event
        EventsAPI.createEvent(ctx, argv.app, node.name.substring(0, 255), start, end, opts, function(err, event) {
            if (err) {
                log().error({'err': err, 'name': node.name}, 'Failed to create event');
                process.exit(1);
            }

            return callback(event);
        });
    });
};
