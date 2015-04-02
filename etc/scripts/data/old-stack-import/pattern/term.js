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

var moment = require('moment');

/**
 * The term model
 *
 * @param  {Number}     year            The academic year this term falls under. Keep in mind that when Lent happens in 2015, the academical year is actually 2014
 * @param  {Moment}     startDate       The date when the term starts according to the Cambridge statutes and ordinances
 * @param  {Number}     termIndex       Which term is being modelled. 0 for Michaelmas, 1 for Eastern and 2 for Lent
 * @see http://www.cam.ac.uk/about-the-university/term-dates-and-calendars
 */
var Term = module.exports.Term = function(year, startDate, termIndex) {
    // Calculate when the first Thursday after the startDate transpires
    var daysTillThursday = (4 - startDate.weekday()) % 7;

    var that = {
        'year': year,
        'startDate': moment(startDate).add(daysTillThursday, 'day'),
        'endDate': moment(startDate).add(8, 'week'),
        'termIndex': termIndex
    };

    /**
     * Get the week of the term in which a given date falls
     *
     * @param  {Moment}     date    The date to calculate the week offset for
     * @return {Number}             The week in which the date falls. 0-based
     */
    that.weekOffset = function(date) {
        return Math.floor(date.diff(that.startDate, 'day') / 7) + 1;
    };

    return that;
};
