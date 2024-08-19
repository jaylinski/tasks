<template>
	<NcModal @close="onClose()">
		<div class="content">
			<h3 class="content__heading">
				{{ t('tasks', 'Create reminder') }}
			</h3>
			<NcDateTimePickerNative id="alarm-date-time-picker"
				v-model="date"
				type="datetime-local"
				:label="t('tasks', 'Set reminder at custom date & time') " />
			<div class="content__buttons">
				<NcButton @click="onClose()">
					{{ t('tasks', 'Cancel') }}
				</NcButton>
				<NcButton type="primary" @click="onSelectDateTime(date)">
					{{ t('tasks', 'Create reminder') }}
				</NcButton>
			</div>
		</div>
	</NcModal>
</template>

<script>
import { getDefaultAbsoluteAlarms } from '../../../utils/alarms.js'
import { translate as t } from '@nextcloud/l10n'
import { NcButton, NcDateTimePickerNative, NcModal } from '@nextcloud/vue'

export default {
	name: 'AlarmDateTimePickerModal',
	components: {
		NcButton,
		NcDateTimePickerNative,
		NcModal,
	},
	emits: [
		'select-date-time',
		'close',
	],
	data() {
		return {
			date: this.defaultAbsoluteAlarm(),
		}
	},
	methods: {
		t,

		defaultAbsoluteAlarm() {
			const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
			const alarms = getDefaultAbsoluteAlarms(timeZone)

			return alarms[0]
		},

		onSelectDateTime(date) {
			this.$emit('select-date-time', date)
		},

		onClose() {
			this.$emit('close')
		},
	},
}
</script>

<style lang="scss" scoped>
.content {
	padding: 14px;

	&__heading {
		margin-top: 0;
	}

	&__buttons {
		display: flex;
		gap: 8px;
		margin-top: 14px;
		justify-content: flex-end;
	}
}
</style>
