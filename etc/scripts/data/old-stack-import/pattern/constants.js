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
var moment = require('moment');

var Term = require('./term').Term;

// The start dates for each term for the forseeable future. Note that these
// dates do NOT start on a Thursday
var TERM_DATES = module.exports.TERM_DATES = {
    '2014': [moment('2014-10-07', 'YYYY-MM-DD'), moment('2015-01-13', 'YYYY-MM-DD'), moment('2015-04-21', 'YYYY-MM-DD')],
    '2015': [moment('2015-10-06', 'YYYY-MM-DD'), moment('2016-01-12', 'YYYY-MM-DD'), moment('2016-04-19', 'YYYY-MM-DD')],
    '2016': [moment('2016-10-04', 'YYYY-MM-DD'), moment('2017-01-17', 'YYYY-MM-DD'), moment('2017-04-25', 'YYYY-MM-DD')],
    '2017': [moment('2017-10-03', 'YYYY-MM-DD'), moment('2018-01-16', 'YYYY-MM-DD'), moment('2018-04-24', 'YYYY-MM-DD')],
    '2018': [moment('2018-10-02', 'YYYY-MM-DD'), moment('2019-01-15', 'YYYY-MM-DD'), moment('2019-04-23', 'YYYY-MM-DD')],
    '2019': [moment('2019-10-08', 'YYYY-MM-DD'), moment('2020-01-14', 'YYYY-MM-DD'), moment('2020-04-21', 'YYYY-MM-DD')],
    '2020': [moment('2020-10-06', 'YYYY-MM-DD'), moment('2021-01-19', 'YYYY-MM-DD'), moment('2021-04-27', 'YYYY-MM-DD')],
    '2021': [moment('2021-10-05', 'YYYY-MM-DD'), moment('2022-01-18', 'YYYY-MM-DD'), moment('2022-04-26', 'YYYY-MM-DD')],
    '2022': [moment('2022-10-04', 'YYYY-MM-DD'), moment('2023-01-17', 'YYYY-MM-DD'), moment('2023-04-25', 'YYYY-MM-DD')],
    '2023': [moment('2023-10-03', 'YYYY-MM-DD'), moment('2024-01-16', 'YYYY-MM-DD'), moment('2024-04-23', 'YYYY-MM-DD')],
    '2024': [moment('2024-10-08', 'YYYY-MM-DD'), moment('2025-01-21', 'YYYY-MM-DD'), moment('2025-04-29', 'YYYY-MM-DD')],
    '2025': [moment('2025-10-07', 'YYYY-MM-DD'), moment('2026-01-20', 'YYYY-MM-DD'), moment('2026-04-28', 'YYYY-MM-DD')],
    '2026': [moment('2026-10-06', 'YYYY-MM-DD'), moment('2027-01-19', 'YYYY-MM-DD'), moment('2027-04-27', 'YYYY-MM-DD')],
    '2027': [moment('2027-10-05', 'YYYY-MM-DD'), moment('2028-01-18', 'YYYY-MM-DD'), moment('2028-04-25', 'YYYY-MM-DD')],
    '2028': [moment('2028-10-03', 'YYYY-MM-DD'), moment('2029-01-16', 'YYYY-MM-DD'), moment('2029-04-24', 'YYYY-MM-DD')],
    '2029': [moment('2029-10-02', 'YYYY-MM-DD'), moment('2030-01-15', 'YYYY-MM-DD'), moment('2030-04-23', 'YYYY-MM-DD')]
};

// The official abbreviations for `Michaelmas`, `Lent` and `Easter`
var TERM_NAMES = module.exports.TERM_NAMES = ['Mi', 'Le', 'Ea'];

// The official set of abbreviations for the days of the week starting on Sunday
var DAY_NAMES = module.exports.DAY_NAMES = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];

// A flat set of all the `Term` objects for the forseeable future. This data will
// be used to find the closest term to a given date
var ALL_TERMS = module.exports.ALL_TERMS = [];

// Build up the set of terms
_.each(TERM_DATES, function(termDates, year) {
    _.each(termDates, function(termDate, i) {
        ALL_TERMS.push(new Term(year, termDate, i));
    });
});
