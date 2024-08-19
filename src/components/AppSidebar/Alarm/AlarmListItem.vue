<!--
  - SPDX-FileCopyrightText: 2019 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<!-- Yes, technically an alarm is a component, not a property, but for the matter of CSS names it really doesn't matter -->
	<div v-click-outside="closeEditMode"
		class="alarm-item">
		<div v-if="!isEditing || !isRelativeAlarm"
			class="alarm-item__label">
			{{ formattedAlarm }}
		</div>
		<div v-if="isEditing && !isRelativeAlarm">
			<AlarmDateTimePickerModal :original-date="alarm.absoluteDate"
				@select-date-time="onChooseDateAndTime"
				@close="closeAlarmModal" />
		</div>
		<div v-if="isEditing && isRelativeAlarm && !isAllDay"
			class="alarm-item__edit alarm-item__edit--timed">
			<input type="number"
				min="0"
				max="3600"
				:value="alarm.relativeAmountTimed"
				@input="changeRelativeAmountTimed">
			<AlarmTimeUnitSelect :is-all-day="isAllDay"
				:count="alarm.relativeAmountTimed"
				:unit="alarm.relativeUnitTimed"
				@change="changeRelativeUnitTimed" />
		</div>
		<div v-if="isEditing && isRelativeAlarm && isAllDay"
			class="alarm-item__edit alarm-item__edit--all-day">
			<div class="alarm-item__edit--all-day__distance">
				<input type="number"
					min="0"
					max="3600"
					:value="alarm.relativeAmountAllDay"
					@input="changeRelativeAmountAllDay">
				<AlarmTimeUnitSelect :is-all-day="isAllDay"
					:count="alarm.relativeAmountAllDay"
					:unit="alarm.relativeUnitAllDay"
					class="time-unit-select"
					@change="changeRelativeUnitAllDay" />
			</div>
			<div class="alarm-item__edit--all-day__time">
				<span class="alarm-item__edit--all-day__time__before-at-label">
					{{ t('tasks', 'before at') }}
				</span>
				<p>TODO Add time picker</p>
			</div>
		</div>
		<div v-if="!isReadOnly"
			class="alarm-item__options">
			<Actions :open="showMenu"
				@update:open="(open) => showMenu = open">
				<ActionRadio v-if="canChangeAlarmType || (!isAlarmTypeDisplay && forceEventAlarmType === 'DISPLAY')"
					:name="alarmTypeName"
					:model-value="isAlarmTypeDisplay"
					@change="changeType('DISPLAY')">
					{{ t('tasks', 'Notification') }}
				</ActionRadio>
				<ActionRadio v-if="canChangeAlarmType || (!isAlarmTypeEmail && forceEventAlarmType === 'EMAIL')"
					:name="alarmTypeName"
					:model-value="isAlarmTypeEmail"
					@change="changeType('EMAIL')">
					{{ t('tasks', 'Email') }}
				</ActionRadio>
				<ActionRadio v-if="canChangeAlarmType && isAlarmTypeAudio"
					:name="alarmTypeName"
					:model-value="isAlarmTypeAudio"
					@change="changeType('AUDIO')">
					{{ t('tasks', 'Audio notification') }}
				</ActionRadio>
				<ActionRadio v-if="canChangeAlarmType && isAlarmTypeOther"
					:name="alarmTypeName"
					:model-value="isAlarmTypeOther"
					@change="changeType(alarm.type)">
					{{ t('tasks', 'Other notification') }}
				</ActionRadio>

				<ActionSeparator />

				<ActionButton v-if="canEdit && !isEditing"
					@click.stop="toggleEditAlarm">
					<template #icon>
						<Pencil :size="20" decorative />
					</template>
					{{ t('tasks', 'Edit time') }}
				</ActionButton>
				<ActionButton v-if="canEdit && isEditing"
					@click="toggleEditAlarm">
					<template #icon>
						<Check :size="20" decorative />
					</template>
					{{ t('tasks', 'Save time') }}
				</ActionButton>

				<ActionButton @click="removeAlarm">
					<template #icon>
						<Delete :size="20" decorative />
					</template>
					{{ t('tasks', 'Remove reminder') }}
				</ActionButton>
			</Actions>
		</div>
	</div>
</template>

<script>
import {
	NcActions as Actions,
	NcActionButton as ActionButton,
	NcActionRadio as ActionRadio,
	NcActionSeparator as ActionSeparator,
} from '@nextcloud/vue'
import { formatAlarm } from '../../../utils/alarms.js'
import AlarmDateTimePickerModal from './AlarmDateTimePickerModal.vue'
import AlarmTimeUnitSelect from './AlarmTimeUnitSelect.vue'
import moment from '@nextcloud/moment'
import Check from 'vue-material-design-icons/Check.vue'
import Delete from 'vue-material-design-icons/Delete.vue'
import Pencil from 'vue-material-design-icons/Pencil.vue'

import { getCanonicalLocale, translate as t } from '@nextcloud/l10n'
import { vOnClickOutside as ClickOutside } from '@vueuse/components'

export default {
	name: 'AlarmListItem',
	components: {
		AlarmDateTimePickerModal,
		AlarmTimeUnitSelect,
		Actions,
		ActionButton,
		ActionRadio,
		ActionSeparator,
		Check,
		Delete,
		Pencil,
	},
	directives: {
		ClickOutside,
	},
	filters: {
		formatAlarm,
	},
	props: {
		alarm: {
			type: Object,
			required: true,
		},
		isAllDay: {
			type: Boolean,
			required: true,
		},
		isReadOnly: {
			type: Boolean,
			required: true,
		},
	},
	emits: [
		'remove-alarm',
		'update-alarm',
	],
	data() {
		return {
			isEditing: false,
			showMenu: false,
		}
	},
	computed: {
		forceEventAlarmType() {
			return false
		},
		locale() {
			return getCanonicalLocale().toLocaleLowerCase()
		},
		canEdit() {
			// You can always edit an alarm if it's absolute
			if (!this.isRelative) {
				return true
			}

			// We don't allow editing when the alarm is
			// related to the event's end
			if (!this.alarm.relativeIsRelatedToStart) {
				return false
			}

			// We don't allow editing when this event is timed
			// and the trigger time is positive
			if (!this.isAllDay && this.alarm.relativeTrigger > 0) {
				return false
			}

			// We don't allow editing when this event is all-day
			// and the trigger time is bigger than one day
			if (this.isAllDay && this.alarm.relativeTrigger > 86400) {
				return false
			}

			return true
		},
		/**
		 * Changing the alarm type is allowed if the alarm type does
		 * not match the forceEventAlarmType (yet).
		 *
		 * If no alarm type is forced (forceEventAlarmType === false),
		 * this will return true as well.
		 */
		canChangeAlarmType() {
			return this.alarm.type !== this.forceEventAlarmType
		},
		alarmTypeName() {
			return this._uid + '-radio-type-name'
		},
		isAlarmTypeDisplay() {
			return this.alarm.type === 'DISPLAY'
		},
		isAlarmTypeEmail() {
			return this.alarm.type === 'EMAIL'
		},
		isAlarmTypeAudio() {
			return this.alarm.type === 'AUDIO'
		},
		isAlarmTypeOther() {
			return !['AUDIO', 'DISPLAY', 'EMAIL'].includes(this.alarm.type)
		},
		isRelativeAlarm() {
			return this.alarm.relativeTrigger !== null
		},
		isAbsoluteAlarm() {
			return !this.isRelativeAlarm
		},
		currentUserTimezone() {
			return new Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
		},
		relativeAllDayDate() {
			const date = new Date()
			date.setHours(this.alarm.relativeHoursAllDay)
			date.setMinutes(this.alarm.relativeMinutesAllDay)

			return date
		},
		timeFormat() {
			return moment.localeData().longDateFormat('LT')
		},
		absoluteDateFormat() {
			return [
				'[',
				t('tasks', 'on'),
				'] ',
				moment.localeData().longDateFormat('L'),
				' [',
				t('tasks', 'at'),
				'] ',
				moment.localeData().longDateFormat('LT'),
			].join('')
		},
		formattedAlarm() {
			return formatAlarm(this.alarm, this.isAllDay, this.currentUserTimezone, this.locale)
		},
	},
	methods: {
		t,

		/**
		 * This method enables the editing mode
		 */
		toggleEditAlarm() {
			this.isEditing = !this.isEditing

			// Hide menu when starting to edit
			if (this.isEditing) {
				this.showMenu = false
			}
		},

		onChooseDateAndTime(date) {
			const alarm = {
				value: date,
				parameter: undefined, // ical.js sets the correct parameter for us when using a `ICAL.Time`-object
			}

			this.$emit('update-alarm', alarm)
			this.closeAlarmModal()
		},

		closeEditMode() {
			if (this.isRelativeAlarm) {
				this.isEditing = false
			}
		},

		closeAlarmModal() {
			this.isEditing = false
		},

		/**
		 * Changes the type of the reminder
		 *
		 * @param {string} type The new type of the notification
		 */
		changeType(type) {
			// TODO
		},

		/**
		 * This method emits the removeAlarm event
		 */
		removeAlarm() {
			this.$emit('remove-alarm', this.alarm)
		},

		/**
		 * changes the relative amount entered in timed mode
		 *
		 * @param {Event} event The Input-event triggered when modifying the input
		 */
		changeRelativeAmountTimed(event) {
			const minimumValue = parseInt(event.target.min, 10)
			const maximumValue = parseInt(event.target.max, 10)
			const selectedValue = parseInt(event.target.value, 10)

			if (selectedValue >= minimumValue && selectedValue <= maximumValue) {
				// TODO
			}
		},

		/**
		 * changes the relative unit entered in timed mode
		 *
		 * @param {string} unit The new unit
		 */
		changeRelativeUnitTimed(unit) {
			// TODO
		},

		/**
		 * changes the relative amount entered in all-day
		 *
		 * @param {Event} event The Input-event triggered when modifying the input
		 */
		changeRelativeAmountAllDay(event) {
			const minimumValue = parseInt(event.target.min, 10)
			const maximumValue = parseInt(event.target.max, 10)
			const selectedValue = parseInt(event.target.value, 10)

			if (selectedValue >= minimumValue && selectedValue <= maximumValue) {
				// TODO
			}
		},

		/**
		 * changes the relative unit entered in all-day mode
		 *
		 * @param {string} unit The new unit
		 */
		changeRelativeUnitAllDay(unit) {
			// TODO
		},
	},
}
</script>

<style lang="scss" scoped>
.alarm-item {
	display: flex;
	align-items: center;

	&__label {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		align-self: center;
	}

	&__options {
		margin-left: auto;
		display: flex;
		align-items: center;
		white-space: nowrap;
	}
}
</style>
