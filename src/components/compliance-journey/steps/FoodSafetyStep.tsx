/**
 * Phase 37c — Step 6: Food Safety Training.
 *
 * Two layers: the owner ("person in charge") needs accredited R638 training,
 * and any staff handling food need basic training. The owner's training
 * status comes from `owner_profiles.food_safety_training_completed`. Staff
 * training is per-teller, toggled via the StaffTrainingList client component.
 *
 * Action row is `variant='standard'` so the owner can also flag the
 * `food_safety_training` business_documents row as complete (some users will
 * want a single "Yes I'm done" checkbox; others will use the staff list).
 */

import { Check } from 'lucide-react'
import { StaffTrainingList } from '../StaffTrainingList'
import { MarkAsDoneButtons } from '../MarkAsDoneButtons'
import type {
  ComplianceJourneyData,
  ComplianceJourneyStep,
} from '@/types'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  step: ComplianceJourneyStep
  data: ComplianceJourneyData
  t: T
}

export function FoodSafetyStep({ step, data, t }: Props) {
  const ownerTrained = !!data.ownerProfile?.food_safety_training_completed

  return (
    <>
      <section className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm">
        <h4 className="font-semibold text-gray-800 mb-2">
          {t('food_what_header')}
        </h4>
        <ol className="list-decimal list-inside text-gray-700 space-y-1.5 mb-3">
          <li>{t('food_what_layer_1')}</li>
          <li>{t('food_what_layer_2')}</li>
        </ol>
        <p className="text-xs text-gray-500">{t('food_what_note')}</p>
      </section>

      {/* Numbered how-to */}
      <section>
        <h4 className="text-sm font-semibold text-gray-800 mb-2">{t('food_how_header')}</h4>
        <ol className="space-y-2">
          {(['food_how_step_1','food_how_step_2','food_how_step_3','food_how_step_4','food_how_step_5'] as const).map((key, i) => (
            <li key={key} className="flex gap-2.5 text-sm text-gray-700">
              <span className="w-5 h-5 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <span>{t(key)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-gray-800 mb-2">
          {t('food_options_header')}
        </h4>
        <ul className="space-y-2 text-sm">
          <li className="bg-white border border-gray-200 rounded-2xl p-3">
            <p className="font-semibold text-gray-900">{t('food_option_online_title')}</p>
            <p className="text-gray-600 mt-1">{t('food_option_online_desc')}</p>
          </li>
          <li className="bg-white border border-gray-200 rounded-2xl p-3">
            <p className="font-semibold text-gray-900">{t('food_option_virtual_title')}</p>
            <p className="text-gray-600 mt-1">{t('food_option_virtual_desc')}</p>
          </li>
          <li className="bg-white border border-gray-200 rounded-2xl p-3">
            <p className="font-semibold text-gray-900">{t('food_option_inperson_title')}</p>
            <p className="text-gray-600 mt-1">{t('food_option_inperson_desc')}</p>
          </li>
        </ul>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-gray-800 mb-2">
          {t('food_owner_status_header')}
        </h4>
        {ownerTrained ? (
          <p className="flex items-start gap-1.5 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
            <Check className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={2.25} />
            <span>{t('food_owner_trained', {
              date: data.ownerProfile?.food_safety_training_date ?? '',
            })}</span>
          </p>
        ) : (
          <p className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
            {t('food_owner_not_trained')}
          </p>
        )}
        <p className="mt-2 text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
          {t('food_keep_cert_note')}
        </p>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-gray-800 mb-2">
          {t('food_staff_header')}
        </h4>
        <StaffTrainingList tellers={data.tellers} />
      </section>

      <MarkAsDoneButtons step={step} variant="standard" />
    </>
  )
}
