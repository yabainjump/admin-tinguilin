import { Component, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  AdminPoll,
  AdminPollOption,
  POLL_DESCRIPTION_MAX,
  POLL_IMAGE_PATH,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_OPTION_LABEL_MAX,
  POLL_QUESTION_MAX,
  PollPayload,
  PollStatus,
} from '../../core/models/poll.models';
import { PollsApiService } from '../../core/services/polls-api.service';
import { RafflesApiService } from '../../core/services/raffles-api.service';
import { apiErrorMessage } from '../../core/utils/api-error.util';
import { UPLOAD_IMAGE_ACCEPT, validateUploadImage } from '../../core/utils/image-file.util';
import { resolveUploadUrl } from '../../core/utils/upload-url.util';
import { environment } from '../../../environments/environment';

type PollAction = 'open' | 'close' | 'delete';

interface PendingPollAction {
  poll: AdminPoll;
  action: PollAction;
}

type OptionGroup = FormGroup<{
  label: FormControl<string>;
  imageUrl: FormControl<string>;
}>;

function futureDateValidator(control: AbstractControl): ValidationErrors | null {
  const raw = String(control.value ?? '').trim();
  if (!raw) return null;
  const time = new Date(raw).getTime();
  if (!Number.isFinite(time)) return { invalidDate: true };
  return time > Date.now() ? null : { notInFuture: true };
}

function pollImagePathValidator(control: AbstractControl): ValidationErrors | null {
  const raw = String(control.value ?? '').trim();
  if (!raw) return null;
  return POLL_IMAGE_PATH.test(raw) ? null : { imagePath: true };
}

@Component({
  selector: 'app-polls-management',
  templateUrl: './polls-management.component.html',
  styleUrls: ['./polls-management.component.scss'],
  standalone: false,
})
export class PollsManagementComponent implements OnInit {
  readonly questionMax = POLL_QUESTION_MAX;
  readonly descriptionMax = POLL_DESCRIPTION_MAX;
  readonly optionLabelMax = POLL_OPTION_LABEL_MAX;
  readonly minOptions = POLL_MIN_OPTIONS;
  readonly maxOptions = POLL_MAX_OPTIONS;
  readonly imageAccept = UPLOAD_IMAGE_ACCEPT;

  isLoading = true;
  errorMessage = '';
  infoMessage = '';
  polls: AdminPoll[] = [];

  actionInProgressId = '';
  pendingAction: PendingPollAction | null = null;
  pendingActionError = '';

  isFormOpen = false;
  editingPollId: string | null = null;
  isSaving = false;
  formErrorMessage = '';

  private readonly uploadingOptions = new Set<AbstractControl>();
  private readonly optionUploadErrors = new Map<AbstractControl, string>();

  readonly form;

  constructor(
    private readonly fb: FormBuilder,
    private readonly pollsApi: PollsApiService,
    private readonly rafflesApi: RafflesApiService,
  ) {
    this.form = this.fb.nonNullable.group({
      question: ['', [Validators.required, Validators.maxLength(POLL_QUESTION_MAX)]],
      description: ['', [Validators.maxLength(POLL_DESCRIPTION_MAX)]],
      endsAt: ['', [futureDateValidator]],
      options: this.fb.array<OptionGroup>([]),
    });
  }

  ngOnInit(): void {
    this.loadPolls();
  }

  // ---------------------------------------------------------------- list

  get hasOpenPoll(): boolean {
    return this.polls.some((p) => p.status === 'OPEN');
  }

  statusLabel(poll: AdminPoll): string {
    switch (poll.status) {
      case 'DRAFT':
        return 'Brouillon';
      case 'OPEN':
        return this.isExpired(poll) ? 'Ouvert (échéance passée)' : 'Ouvert';
      case 'CLOSED':
        return 'Fermé';
      default:
        return String(poll.status);
    }
  }

  statusClass(status: PollStatus): string {
    switch (status) {
      case 'DRAFT':
        return 'draft';
      case 'OPEN':
        return 'open';
      case 'CLOSED':
        return 'closed';
      default:
        return '';
    }
  }

  isExpired(poll: AdminPoll): boolean {
    if (!poll.endsAt) return false;
    const time = new Date(poll.endsAt).getTime();
    return Number.isFinite(time) && time <= Date.now();
  }

  isLeading(poll: AdminPoll, option: AdminPollOption): boolean {
    if (poll.totalVotes <= 0) return false;
    const max = Math.max(...poll.options.map((o) => o.votes));
    return option.votes === max && max > 0;
  }

  barWidth(option: AdminPollOption): number {
    const percent = Number(option.percent);
    if (!Number.isFinite(percent)) return 0;
    return Math.min(100, Math.max(0, percent));
  }

  optionImage(path: string | null | undefined): string | null {
    const raw = String(path ?? '').trim();
    if (!POLL_IMAGE_PATH.test(raw)) return null;
    return resolveUploadUrl(raw, environment.apiBaseUrl, '/uploads/products/');
  }

  // ------------------------------------------------------------- actions

  askAction(poll: AdminPoll, action: PollAction): void {
    this.infoMessage = '';
    this.pendingActionError = '';
    this.pendingAction = { poll, action };
  }

  cancelAction(): void {
    if (this.pendingAction && this.actionInProgressId === this.pendingAction.poll.id) return;
    this.pendingAction = null;
    this.pendingActionError = '';
  }

  isPendingFor(poll: AdminPoll, action?: PollAction): boolean {
    const pending = this.pendingAction;
    if (!pending || pending.poll.id !== poll.id) return false;
    return action ? pending.action === action : true;
  }

  confirmationText(action: PollAction): string {
    switch (action) {
      case 'open':
        return 'Ouvrir ce sondage ? Il sera visible par les joueurs et ne pourra plus être modifié.';
      case 'close':
        return 'Fermer ce sondage ? Les joueurs ne pourront plus voter.';
      case 'delete':
        return 'Supprimer définitivement ce brouillon ?';
    }
  }

  confirmLabel(action: PollAction): string {
    switch (action) {
      case 'open':
        return 'Oui, ouvrir';
      case 'close':
        return 'Oui, fermer';
      case 'delete':
        return 'Oui, supprimer';
    }
  }

  confirmAction(): void {
    const pending = this.pendingAction;
    if (!pending || this.actionInProgressId) return;

    const { poll, action } = pending;
    this.actionInProgressId = poll.id;
    this.pendingActionError = '';
    this.errorMessage = '';
    this.infoMessage = '';

    const request$ =
      action === 'open'
        ? this.pollsApi.openPoll(poll.id)
        : action === 'close'
          ? this.pollsApi.closePoll(poll.id)
          : this.pollsApi.deletePoll(poll.id);

    request$.subscribe({
      next: () => {
        this.actionInProgressId = '';
        this.pendingAction = null;
        this.infoMessage =
          action === 'open'
            ? 'Sondage ouvert aux votes.'
            : action === 'close'
              ? 'Sondage fermé.'
              : 'Brouillon supprimé.';
        this.loadPolls();
      },
      error: (err) => {
        this.actionInProgressId = '';
        this.pendingActionError = apiErrorMessage(err, 'Action impossible sur ce sondage.');
      },
    });
  }

  // ---------------------------------------------------------------- form

  get optionsArray(): FormArray<OptionGroup> {
    return this.form.controls.options;
  }

  get isUploadingAny(): boolean {
    return this.uploadingOptions.size > 0;
  }

  get canAddOption(): boolean {
    return this.optionsArray.length < POLL_MAX_OPTIONS;
  }

  get canRemoveOption(): boolean {
    return this.optionsArray.length > POLL_MIN_OPTIONS;
  }

  openCreateForm(): void {
    this.editingPollId = null;
    this.resetForm();
    this.addOption();
    this.addOption();
    this.isFormOpen = true;
  }

  openEditForm(poll: AdminPoll): void {
    if (poll.status !== 'DRAFT') return;
    this.editingPollId = poll.id;
    this.resetForm();
    this.form.patchValue({
      question: poll.question ?? '',
      description: poll.description ?? '',
      endsAt: this.toDatetimeLocal(poll.endsAt),
    });
    const options = poll.options.slice(0, POLL_MAX_OPTIONS);
    for (const option of options) {
      this.addOption(option.label, POLL_IMAGE_PATH.test(option.imageUrl ?? '') ? option.imageUrl : '');
    }
    while (this.optionsArray.length < POLL_MIN_OPTIONS) {
      this.addOption();
    }
    this.form.controls.endsAt.markAsTouched();
    this.isFormOpen = true;
  }

  closeForm(): void {
    if (this.isSaving) return;
    this.isFormOpen = false;
    this.editingPollId = null;
    this.resetForm();
  }

  addOption(label = '', imageUrl = ''): void {
    if (this.optionsArray.length >= POLL_MAX_OPTIONS) return;
    this.optionsArray.push(
      this.fb.nonNullable.group({
        label: [label, [Validators.required, Validators.maxLength(POLL_OPTION_LABEL_MAX)]],
        imageUrl: [imageUrl, [pollImagePathValidator]],
      }),
    );
  }

  removeOption(index: number): void {
    if (!this.canRemoveOption) return;
    const group = this.optionsArray.at(index);
    this.uploadingOptions.delete(group);
    this.optionUploadErrors.delete(group);
    this.optionsArray.removeAt(index);
  }

  isOptionUploading(group: AbstractControl): boolean {
    return this.uploadingOptions.has(group);
  }

  optionUploadError(group: AbstractControl): string {
    return this.optionUploadErrors.get(group) ?? '';
  }

  clearOptionImage(group: OptionGroup): void {
    group.controls.imageUrl.setValue('');
    this.optionUploadErrors.delete(group);
  }

  onOptionImageSelected(group: OptionGroup, event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    if (input) input.value = '';
    this.optionUploadErrors.delete(group);
    if (!file) return;

    const validationError = validateUploadImage(file);
    if (validationError) {
      this.optionUploadErrors.set(group, validationError);
      return;
    }

    this.uploadingOptions.add(group);
    this.rafflesApi.uploadProductImage(file).subscribe({
      next: (res) => {
        this.uploadingOptions.delete(group);
        const imageUrl = String(res?.imageUrl ?? '').trim();
        if (!POLL_IMAGE_PATH.test(imageUrl)) {
          this.optionUploadErrors.set(group, "Réponse d'upload inattendue : image non retenue.");
          return;
        }
        group.controls.imageUrl.setValue(imageUrl);
      },
      error: (err) => {
        this.uploadingOptions.delete(group);
        this.optionUploadErrors.set(group, apiErrorMessage(err, "Upload de l'image impossible."));
      },
    });
  }

  fieldLength(value: string | null | undefined): number {
    return String(value ?? '').length;
  }

  submitForm(): void {
    if (this.isSaving || this.isUploadingAny) return;
    this.formErrorMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formErrorMessage = 'Vérifie les champs signalés avant d’enregistrer.';
      return;
    }

    const payload = this.buildPayload();
    if (!payload) return;

    this.isSaving = true;
    this.infoMessage = '';
    const editingId = this.editingPollId;
    const request$ = editingId
      ? this.pollsApi.updatePoll(editingId, payload)
      : this.pollsApi.createPoll(payload);

    request$.subscribe({
      next: () => {
        this.isSaving = false;
        this.isFormOpen = false;
        this.editingPollId = null;
        this.resetForm();
        this.infoMessage = editingId ? 'Brouillon mis à jour.' : 'Sondage créé en brouillon.';
        this.loadPolls();
      },
      error: (err) => {
        this.isSaving = false;
        this.formErrorMessage = apiErrorMessage(err, 'Enregistrement du sondage impossible.');
      },
    });
  }

  private buildPayload(): PollPayload | null {
    const value = this.form.getRawValue();
    const question = value.question.trim();
    const description = value.description.trim();
    const options = value.options.map((o) => {
      const label = o.label.trim();
      const imageUrl = o.imageUrl.trim();
      return POLL_IMAGE_PATH.test(imageUrl) ? { label, imageUrl } : { label };
    });

    if (!question) {
      this.formErrorMessage = 'La question est obligatoire.';
      return null;
    }
    if (options.some((o) => !o.label)) {
      this.formErrorMessage = 'Chaque choix doit avoir un libellé.';
      return null;
    }
    if (options.length < POLL_MIN_OPTIONS || options.length > POLL_MAX_OPTIONS) {
      this.formErrorMessage = `Il faut entre ${POLL_MIN_OPTIONS} et ${POLL_MAX_OPTIONS} choix.`;
      return null;
    }

    const payload: PollPayload = { question, options };
    if (description) payload.description = description;

    const endsAtRaw = value.endsAt.trim();
    if (endsAtRaw) {
      const date = new Date(endsAtRaw);
      if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
        this.formErrorMessage = 'La date de fin doit être dans le futur.';
        return null;
      }
      payload.endsAt = date.toISOString();
    }
    return payload;
  }

  private resetForm(): void {
    this.form.reset({ question: '', description: '', endsAt: '' });
    this.optionsArray.clear();
    this.uploadingOptions.clear();
    this.optionUploadErrors.clear();
    this.formErrorMessage = '';
  }

  /** ISO -> valeur `datetime-local` (heure locale du navigateur). */
  private toDatetimeLocal(iso: string | null | undefined): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
  }

  private loadPolls(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.pollsApi.listPolls().subscribe({
      next: (rows) => {
        this.polls = rows;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = apiErrorMessage(err, 'Impossible de charger les sondages.');
      },
    });
  }
}
