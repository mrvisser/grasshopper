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

var util = require('util');

var moment = require('moment-timezone');

/**
 * The model that holds information about when an event takes place during the day
 *
 * @param  {Moment}     start       The start time of the event
 * @param  {Moment}     end         The end time of the event
 */
var DayTime = module.exports.DayTime = function(start, end) {

    var that = {
        // Which day of the week the event starts, Sunday = 0
        'dayOfWeek': start.weekday(),
        'startHour': start.hour(),
        'startMinute': start.minute(),
        'endHour': end.hour(),
        'endMinute': end.minute()
    };

    /**
     * Compare this daytime instance to another
     *
     * @param  {DayTime}    other       The daytime instance to compare to
     * @return {Boolean}                `true` if the other daytime instance occurs at the same day of the week and holds events at the same timeslot
     */
    that.equals = function(other) {
        return (that.dayOfWeek === other.dayOfWeek &&
                that.startHour === other.startHour &&
                that.startMinute === other.startMinute &&
                that.endHour === other.endHour &&
                that.endMinute === other.endMinute);
    };

    /**
     * Get the day of the week and a nicely formatted string for when the event(s) take place
     *
     * @return {Object}     An object that holds the `day` and `time` for when the event(s) take place
     */
    that.getFormattedData = function() {
        return {
            'day': that.dayOfWeek,
            'time': that.formatTime()
        };
    };

    /**
     * Get the time when one or more events take place
     *
     * @return {String}     A nicely formatted string for when the event(s) take place
     */
    that.formatTime = function() {
        // If the event lasts exactly 1 hour, only the start values should be returned
        if (that.startMinute === that.endMinute && that.endHour === (that.startHour + 1)) {
            return format(that.startHour, that.startMinute);

        // Otherwise we return both the start and end hour
        } else {
            return util.format('%s-%s', format(that.startHour, that.startMinute), format(that.endHour, that.endMinute));
        }
    };

    return that;
};

/**
 * Format a start or end time
 *
 * @param  {Number}     hour        The hour to format
 * @param  {Number}     minutes     The minutes to format
 * @return {String}                 The formatted time
 * @api private
 */
var format = function(hour, minutes) {
    // Ensure a 12-hour format
    var s = hour % 12;

    // Output twelve o'clock as 12 and not 0
    if (s === 0) {
        s = 12;
    }

    // Only add the minutes, if the event doesn't start/end on the hour
    if (minutes !== 0) {
        s += ':' + minutes;
    }

    // If the event takes place before 8am, append an exclamation mark
    // Warning: This is a deviation from "the spec" as the original Timetable
    // logic would've appended this after the hour. e.g., 6!:30 rather than 6:30!
    if (hour <= 7) {
        s += '!';
    }
    return s;
};
