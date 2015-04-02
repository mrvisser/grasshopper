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

var CambridgeConstants = require('./constants');

/**
 * The model that holds information about which week of a term a date is in
 *
 * @param  {Moment}     date        The date for which to get the Termweek
 */
var TermWeek = module.exports.TermWeek = function(date) {
    // Get the term that contains or is closest to the given date
    var term = getTerm(date);

    var that = {
        'term': term,

        // Get the week in which the date falls
        'week': term.weekOffset(date)
    };

    /**
     * Compare this TermWeek instance to another
     *
     * @param  {TermWeek}    other      The TermWeek instance to compare to
     * @return {Boolean}                `true` if the other TermWeek instance is the same
     */
    that.equals = function(other) {
        return (that.term.termIndex === other.term.termIndex && that.week === other.week);
    };

    return that;
};

/**
 * Given a date, get the the term that either contains it or is closest to it
 *
 * @param  {Moment}     date    The date for which to get the term
 * @return {Term}               The term that either contains the date or that is closests to it
 * @api private
 */
var getTerm = function(date) {
    var closest = {'distance': Number.MAX_VALUE, 'term': null};

    // Iterate over each term and find the term that either contains the date
    // or that's closest to it by calculating the offset between the date and
    // the beginning and end of each term. The term with the smallest offset
    // is the term closest to or contains the date
    _.each(CambridgeConstants.ALL_TERMS, function(term) {
        var distance = _.min([
            Math.abs(term.startDate.diff(date, 'second')),
            Math.abs(term.endDate.diff(date, 'second'))
        ]);
        if (distance < closest.distance) {
            closest.distance = distance;
            closest.term = term;
        }
    });

    return closest.term;
};
