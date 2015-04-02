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
var moment = require('moment-timezone');

var CambridgeConstants = require('./constants');
var DayTime = require('./daytime').DayTime;
var TermWeek = require('./termweek').TermWeek;

/**
 * The model that holds the pattern information for one or more events. Events that fall
 * on similar timeslots can be merged into a single pattern.
 *
 * @param  {Date}       start       The start time of the initial event (in UTC)
 * @param  {Date}       end         The end time of the initial event (in UTC)
 */
var Pattern = module.exports.Pattern = function(start, end) {
    // These patterns are only useful within Cambridge. We convert the given UTC
    // times into the times as they are in London. This makes stringifying patterns
    // slightly easier. This deviation from the "always-work-in-UTC"
    // is acceptable as:
    //  - this will only get used on the Cambridge Timetable application
    //  - this value will end up in a format that is not easily modifiable by the UI
    start = moment.tz(start, 'Europe/London');
    end = moment.tz(end, 'Europe/London');

    var that = {
        'dayTimes': [new DayTime(start, end)],
        'termWeeks': [new TermWeek(start)]
    };

    /**
     * Try to merge another pattern into this one. A merge can only happen
     * if the day times and/or the term weeks are the same
     *
     * @param  {Pattern}    otherPattern    The pattern to try and merge into this pattern
     * @return {Boolean}                    `true` if date from the other pattern was merged into this one
     */
    that.merge = function(otherPattern) {
        // If both patterns have the same day times, we can merge the term weeks
        if (that.equalDayTimes(otherPattern)) {
            that.termWeeks = that.termWeeks.concat(otherPattern.termWeeks);
            that.termWeeks = that.termWeeks.sort(function(termWeekA, termWeekB) {
                // Sort on term first
                if (termWeekA.term.startDate.isBefore(termWeekB.term.startDate)) {
                    return -1;
                } else if (termWeekA.term.startDate.isAfter(termWeekB.term.startDate)) {
                    return 1;
                }

                // If the terms are the same, we have to sort on the week in the term
                return termWeekA.week - termWeekB.week;
            });
            return true;

        // If both patterns have the same term weeks, we can merge the day times
        } else if (that.equalTermWeeks(otherPattern)) {
            that.dayTimes = that.dayTimes.concat(otherPattern.dayTimes);
            return true;
        }

        return false;
    };

    /**
     * Return a pattern as a formatted string. Patterns are of the form `Mi1-9 Th 5``
     *
     * @return {String} The formatted pattern
     */
    that.toString = function() {
        // Build up a hash of term --> weeks. This is so we can generate
        // strings such as `Mi 1-4`
        var weeksByTerm = {};
        _.each(that.termWeeks, function(termWeek) {
            weeksByTerm[termWeek.term.termIndex] = weeksByTerm[termWeek.term.termIndex] || {};
            weeksByTerm[termWeek.term.termIndex][termWeek.week] = true;
        });

        // Get the terms
        var terms = _.chain(weeksByTerm)
                .keys()
                .map(function(term) { return parseInt(term, 10); })
                .sortBy()
                .value();

        // Iterate over each term and stringify the termweek identifier
        var stringifiedTerms = _.map(terms, function(term) {

            // Get the weeks that have one or more events in this term
            var weeks = _.chain(weeksByTerm[term])
                .keys()
                .map(function(week) { return parseInt(week, 10); })
                .sortBy()
                .value();

            // Get the term prefix (`Mi`, `Le` or `Ea`)
            var str = CambridgeConstants.TERM_NAMES[term];

            // If there's an event in each week of the term, we can just
            // return the prefix, otherwise we need to add the week numbers
            // For example, `[1, 2, 3, 4, 7]` should be formatted as `1-4, 7`
            if (!isFullTerm(weeks)) {
                // Build up an array in which element is an array of consecutive blocks
                var arr = aggregateNumbers(weeks);

                // Generate an array of strings for the blocks. In the above example
                // the array would look like: ['1-4', '7']
                arr = _.map(arr, function(block) {
                    if (block.length > 1) {
                        return _.first(block) + '-' + _.last(block);
                    } else {
                        return _.first(block);
                    }
                });

                // Append the week information to the term
                str += arr.join(',');
            }

            // Return this term's information
            return str;
        });

        // Day of the week + hours formatting
        // Build up a hash of timeslots -> days. This is so we can generate
        // strings such as `We-Fr 9`
        var daysByTime = {};
        _.each(that.dayTimes, function(dayTime) {
            var formattedData = dayTime.getFormattedData();
            daysByTime[formattedData.time] = daysByTime[formattedData.time] || {};
            daysByTime[formattedData.time][formattedData.day] = true;
        });

        // Get the timeslots
        var times = _.keys(daysByTime).sort();

        var stringifiedTimes = _.map(times, function(time) {
            // Get the days for this timeslot
            var days = _.chain(daysByTime[time])
                .keys()
                .map(function(day) { return parseInt(day, 10); })
                .sortBy()
                .value();

            // Build up an array in which element is an array of consecutive blocks
            var arr = aggregateNumbers(days);
            arr = _.map(arr, function(block) {
                if (block.length > 1) {
                    return CambridgeConstants.DAY_NAMES[_.first(block)] + '-' + CambridgeConstants.DAY_NAMES[_.last(block)];
                } else {
                    return CambridgeConstants.DAY_NAMES[_.first(block)];
                }
            });

            return arr.join(',') + ' ' + time;
        });

        stringifiedTimes = stringifiedTimes.join(' ');

        return stringifiedTerms + ' ' + stringifiedTimes;
    };

    /**
     * Compare the day times of this pattern to another one
     *
     * @param  {Pattern}    otherPattern    Another pattern to compare the day times to
     * @return {Boolean}                    `true` if the day times are the same
     */
    that.equalDayTimes = function(otherPattern) {
        if (that.dayTimes.length === otherPattern.dayTimes.length) {
            for (var i = 0; i < that.dayTimes.length; i++) {
                if (!that.dayTimes[i].equals(otherPattern.dayTimes[i])) {
                    return false;
                }
            }
            return true;
        }

        return false;
    };

    /**
     * Compare the term weeks of this pattern to another one
     *
     * @param  {Pattern}    otherPattern    Another pattern to compare the term weeks to
     * @return {Boolean}                    `true` if the term weeks are the same
     */
    that.equalTermWeeks = function(otherPattern) {
        if (that.termWeeks.length === otherPattern.termWeeks.length) {
            for (var i = 0; i < that.termWeeks.length; i++) {
                if (!that.termWeeks[i].equals(otherPattern.termWeeks[i])) {
                    return false;
                }
            }

            return true;
        }

        return false;
    };

    return that;
};

/**
 * Given a set of weeks, determine whether they cover an entire term
 *
 * @param  {Number[]}   weeks       A set of week numbers
 * @return {Boolean}                `true` if the set of weeks covers an entire term
 * @api private
 */
var isFullTerm = function(weeks) {
    // A full term must have 8 weeks
    if (weeks.length !== 8) {
        return false;
    }

    // Check if each week is present in the `weeks` array
    weeks = weeks.sort();
    for (var i = 0; i < 8; i++) {
        if (weeks[i] !== i) {
            return false;
        }
    }

    return true;
};

/**
 * Given a set of numbers, aggregate them into an array of consecutive blocks.
 * For example, given the array of [1, 2, 3, 5, 7, 8], the array that would
 * be returned is: [ [1, 2, 3], [5], [7, 8] ]
 *
 * @param  {Number[]}       numbers     The numbers to aggregate
 * @return {Number[][]}                 An array of blocks. Each block is an array of consecutive numbers
 */
var aggregateNumbers = function(numbers) {
    // Ensure the set of numbers are sorted
    numbers = numbers.sort();

    // The first number is the start of the initial block
    var arr = [[numbers[0]]];

    // Iterate over the remaining numbers
    for (var i = 1; i < numbers.length; i++) {

        // If this number is an increment of the previous, we push
        // it into the last block
        if (numbers[i] === numbers[i - 1] + 1) {
            _.last(arr).push(numbers[i]);

        // Otherwise we create a new block
        } else {
            arr.push([numbers[i]]);
        }
    }

    return arr;
};
