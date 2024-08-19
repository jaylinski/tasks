/**
 * SPDX-FileCopyrightText: 2019 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { AttendeeProperty, Property } from '@nextcloud/calendar-js'
import { translate as t, translatePlural as n } from '@nextcloud/l10n'
import moment from '@nextcloud/moment'

/**
 * Get the factor for a given unit
 *
 * @param {string} unit The name of the unit to get the factor of
 * @return {number}
 */
export function getFactorForAlarmUnit(unit) {
	switch (unit) {
	case 'seconds':
		return 1

	case 'minutes':
		return 60

	case 'hours':
		return 60 * 60

	case 'days':
		return 24 * 60 * 60

	case 'weeks':
		return 7 * 24 * 60 * 60

	default:
		return 1
	}
}

/**
 * Gets the amount of days / weeks, unit from total seconds
 *
 * @param {number} totalSeconds Total amount of seconds
 * @return {{amount: number, unit: string}}
 */
export function getAmountAndUnitForTimedEvents(totalSeconds) {
	// Before or after the event is handled somewhere else,
	// so make sure totalSeconds is positive
	totalSeconds = Math.abs(totalSeconds)

	// Handle the special case of 0, so we don't show 0 weeks
	if (totalSeconds === 0) {
		return {
			amount: 0,
			unit: 'minutes',
		}
	}

	if (totalSeconds % (7 * 24 * 60 * 60) === 0) {
		return {
			amount: totalSeconds / (7 * 24 * 60 * 60),
			unit: 'weeks',
		}
	}
	if (totalSeconds % (24 * 60 * 60) === 0) {
		return {
			amount: totalSeconds / (24 * 60 * 60),
			unit: 'days',
		}
	}
	if (totalSeconds % (60 * 60) === 0) {
		return {
			amount: totalSeconds / (60 * 60),
			unit: 'hours',
		}
	}
	if (totalSeconds % (60) === 0) {
		return {
			amount: totalSeconds / (60),
			unit: 'minutes',
		}
	}

	return {
		amount: totalSeconds,
		unit: 'seconds',
	}
}

/**
 * Gets the amount of days / weeks, unit, hours and minutes from total seconds
 *
 * @param {number} totalSeconds Total amount of seconds
 * @return {{amount: *, unit: *, hours: *, minutes: *}}
 */
export function getAmountHoursMinutesAndUnitForAllDayEvents(totalSeconds) {
	const dayFactor = getFactorForAlarmUnit('days')
	const hourFactor = getFactorForAlarmUnit('hours')
	const minuteFactor = getFactorForAlarmUnit('minutes')
	const isNegative = totalSeconds < 0
	totalSeconds = Math.abs(totalSeconds)

	let dayPart = Math.floor(totalSeconds / dayFactor)
	const hourPart = totalSeconds % dayFactor

	if (hourPart !== 0) {
		if (isNegative) {
			dayPart++
		}
	}

	let amount = 0
	let unit = null
	if (dayPart === 0) {
		unit = 'days'
	} else if (dayPart % 7 === 0) {
		amount = dayPart / 7
		unit = 'weeks'
	} else {
		amount = dayPart
		unit = 'days'
	}

	let hours = Math.floor(hourPart / hourFactor)
	const minutePart = hourPart % hourFactor
	let minutes = Math.floor(minutePart / minuteFactor)

	if (isNegative) {
		hours = 24 - hours

		if (minutes !== 0) {
			hours--
			minutes = 60 - minutes
		}
	}

	return {
		amount,
		unit,
		hours,
		minutes,
	}
}

/**
 * Propagate data from an event component to all EMAIL alarm components.
 * An alarm component must contain a description, summary and all attendees to be notified.
 * We don't have a separate UI for maintaining attendees of an alarm, so we just copy them from the event.
 *
 * https://www.rfc-editor.org/rfc/rfc5545#section-3.6.6
 *
 * @param {AbstractRecurringComponent} eventComponent
 */
export function updateAlarms(eventComponent) {
	for (const alarmComponent of eventComponent.getAlarmIterator()) {
		if (alarmComponent.action !== 'EMAIL' && alarmComponent.action !== 'DISPLAY') {
			continue
		}

		alarmComponent.deleteAllProperties('SUMMARY')
		const summaryProperty = eventComponent.getFirstProperty('SUMMARY')
		if (summaryProperty) {
			alarmComponent.addProperty(summaryProperty.clone())
		} else {
			const defaultSummary = t('tasks', 'Untitled event')
			alarmComponent.addProperty(new Property('SUMMARY', defaultSummary))
		}

		if (!alarmComponent.hasProperty('DESCRIPTION')) {
			const defaultDescription = t('tasks', 'This is an event reminder.')
			alarmComponent.addProperty(new Property('DESCRIPTION', defaultDescription))
		}

		alarmComponent.deleteAllProperties('ATTENDEE')
		for (const attendee of eventComponent.getAttendeeIterator()) {
			if (['RESOURCE', 'ROOM'].includes(attendee.userType)) {
				continue
			}

			// Only copy the email address (value) of the attendee
			alarmComponent.addProperty(new AttendeeProperty('ATTENDEE', attendee.value))
		}
	}
}

/**
 * @param {boolean} allDay is all day?
 */
export function getDefaultAlarms(allDay = false) {
	if (allDay) {
		return [
			9 * 60 * 60, // On the day of the event at 9am
			-15 * 60 * 60, // 1 day before at 9am
			-39 * 60 * 60, // 2 days before at 9am
			-159 * 60 * 60, // 1 week before at 9am
		]
	} else {
		return [
			0, // At the time of the event
			-10 * 60, // 10 minutes before
			-30 * 60, // 30 minutes before
			-1 * 60 * 60, // 1 hour before
			-2 * 60 * 60, // 2 hour before
			-1 * 24 * 60 * 60, // 1 day before
			-2 * 24 * 60 * 60, // 2 days before
		]
	}
}

/**
 * @param {number|string} timeZone
 * @return {Date[]}
 */
export function getDefaultAbsoluteAlarms(timeZone) {
	return [
		moment().utcOffset(timeZone).add(1, 'day').startOf('day').add(9, 'hours').toDate(),
	]
}

/**
 * Formats an alarm
 *
 * @param {object} alarm The alarm object to format
 * @param {boolean} isAllDay Whether or not the event is all-day
 * @param {string} currentUserTimezone The current timezone of the user
 * @param {string} locale The locale to format it in
 * @return {string}
 */
export function formatAlarm(alarm, isAllDay, currentUserTimezone, locale) {
	if (alarm.relativeTrigger !== null) {
		// Relative trigger
		if (isAllDay && alarm.relativeIsRelatedToStart && alarm.relativeTrigger < 86400) {
			if (alarm.relativeTrigger === 0) {
				return t('tasks', 'Midnight on the day the task starts')
			}

			const date = new Date()
			date.setHours(alarm.relativeHoursAllDay)
			date.setMinutes(alarm.relativeMinutesAllDay)
			date.setSeconds(0)
			date.setMilliseconds(0)
			const formattedHourMinute = moment(date).locale(locale).format('LT')

			if (alarm.relativeTrigger < 0) {
				if (alarm.relativeUnitAllDay === 'days') {
					return n('calendar',
						'%n day before the task at {formattedHourMinute}',
						'%n days before the task at {formattedHourMinute}',
						alarm.relativeAmountAllDay, {
							formattedHourMinute,
						})
				} else {
					return n('calendar',
						'%n week before the task at {formattedHourMinute}',
						'%n weeks before the task at {formattedHourMinute}',
						alarm.relativeAmountAllDay, {
							formattedHourMinute,
						})
				}
			}
			return t('tasks', 'on the day of the task at {formattedHourMinute}', {
				formattedHourMinute,
			})
		} else {
			// Alarms at the task's start or end
			if (alarm.relativeTrigger === 0) {
				if (alarm.relativeIsRelatedToStart) {
					return t('tasks', 'at the task\'s start')
				} else {
					return t('tasks', 'when the task is due')
				}
			}

			const time = moment.duration(Math.abs(alarm.relativeTrigger), 'seconds').locale(locale).humanize()

			if (alarm.relativeTrigger < 0) {
				if (alarm.relativeIsRelatedToStart) {
					return t('tasks', '{time} before the task starts', { time })
				} else {
					return t('tasks', '{time} before the task is due', { time })
				}
			}

			if (alarm.relativeIsRelatedToStart) {
				return t('tasks', '{time} after the task starts', { time })
			} else {
				return t('tasks', '{time} after the task is due', { time })
			}
		}
	} else {
		// Absolute trigger
		// There are no timezones in tasks, since dates can only be set in the current timezone and are saved as UTC.
		// We still have to account for tasks in other timezones in case the user imports tasks with custom timezones
		// or switches timezones.
		if (currentUserTimezone === alarm.absoluteTimezoneId) {
			return t('tasks', '{time}', {
				time: moment(alarm.absoluteDate).locale(locale).calendar(),
			})
		} else {
			// TODO test with non-UTC timezones
			return t('tasks', '{time} ({timezoneId})', {
				time: moment.utc(alarm.absoluteDate).local().locale(locale).calendar(),
				timezoneId: alarm.absoluteTimezoneId,
			})
		}
	}
}

/**
 * @param {number} time Total amount of seconds for the trigger
 * @param {boolean} relatedToStart If the alarm is related to the start of the event
 * @return {object} The alarm object
 */
export function getAlarmObjectFromTriggerTime(time, relatedToStart) {
	const timedData = getAmountAndUnitForTimedEvents(time)
	const allDayData = getAmountHoursMinutesAndUnitForAllDayEvents(time)

	return {
		isRelative: true,
		relativeTrigger: time,
		relativeIsBefore: time < 0,
		relativeIsRelatedToStart: relatedToStart,
		relativeUnitTimed: timedData.unit,
		relativeAmountTimed: timedData.amount,
		relativeUnitAllDay: allDayData.unit,
		relativeAmountAllDay: allDayData.amount,
		relativeHoursAllDay: allDayData.hours,
		relativeMinutesAllDay: allDayData.minutes,
	}
}

/**
 * @param {Date} date
 * @param {string} timeZone
 * @return {object} The alarm object
 */
export function getAlarmObjectFromDateTime(date, timeZone) {
	return {
		isRelative: false,
		relativeTrigger: null,
		absoluteDate: date,
		absoluteTimezoneId: timeZone,
	}
}
