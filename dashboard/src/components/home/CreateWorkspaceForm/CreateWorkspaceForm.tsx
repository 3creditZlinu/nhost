import Form from '@/components/common/Form';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import { useInsertWorkspaceMutation } from '@/utils/__generated__/graphql';
import { slugifyString } from '@/utils/helpers';
import { nhost } from '@/utils/nhost';
import { toastStyleProps } from '@/utils/settings/settingsConstants';
import { yupResolver } from '@hookform/resolvers/yup';
import { useRouter } from 'next/router';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

export interface CreateWorkspaceFormProps {
  /**
   * Determines whether the form is disabled.
   */
  disabled?: boolean;
  /**
   * Submit button text.
   *
   * @default 'Save'
   */
  submitButtonText?: string;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => void;
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
}

export interface CreateWorkspaceFormValues {
  /**
   * New workspace name.
   */
  newWorkspaceName: string;
}

const validationSchema = Yup.object().shape({
  newWorkspaceName: Yup.string()
    .required('Workspace name is required.')
    .min(4, 'The new Workspace name must be at least 4 characters.')
    .max(32, "The new Workspace name can't be longer than 32 characters.")
    .test('canBeSlugified', 'This is not a valid JSON.', (value) => {
      try {
        const slug = slugifyString(value);
        if (slug.length < 4 || slug.length > 32) {
          throw new Error(
            "This field should be at least 4 characters and can't be longer than 32 characters.",
          );
        }
        return true;
      } catch (error) {
        return false;
      }
    }),
});

export default function CreateWorkspaceForm({
  disabled,
  onSubmit,
  onCancel,
  submitButtonText = 'Save',
}: CreateWorkspaceFormProps) {
  const [insertWorkspace, { client }] = useInsertWorkspaceMutation();
  const router = useRouter();

  const form = useForm<CreateWorkspaceFormValues>({
    defaultValues: {
      newWorkspaceName: '',
    },
    resolver: yupResolver(validationSchema),
  });

  const {
    register,
    formState: { dirtyFields, isSubmitting, errors },
  } = form;
  const isDirty = Object.keys(dirtyFields).length > 0;

  const currentUser = nhost.auth.getUser();

  async function handleSubmit({ newWorkspaceName }: CreateWorkspaceFormValues) {
    const slug = slugifyString(newWorkspaceName);

    const updateAppPromise = insertWorkspace({
      variables: {
        workspace: {
          name: newWorkspaceName,
          companyName: newWorkspaceName,
          email: currentUser.email,
          slug,
          workspaceMembers: {
            data: [
              {
                userId: currentUser.id,
                type: 'owner',
              },
            ],
          },
        },
      },
    });

    await toast.promise(
      updateAppPromise,
      {
        loading: 'Creating new workspace...',
        success: 'New workspace created successfully.',
        error: 'An error occurred while creating new workspace.',
      },
      toastStyleProps,
    );
    await client.refetchQueries({
      include: ['getOneUser'],
    });
    await router.push(`/${slug}`);

    onSubmit?.();
  }

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="flex flex-col content-between flex-auto pt-2 pb-6 overflow-hidden"
      >
        <div className="flex-auto px-6 overflow-y-auto">
          <Input
            {...register('newWorkspaceName')}
            error={Boolean(errors.newWorkspaceName?.message)}
            label="Workspace"
            helperText={errors.newWorkspaceName?.message}
            autoFocus={!disabled}
            disabled={disabled}
            aria-label="Workspace"
            fullWidth
            hideEmptyHelperText
            placeholder='e.g. "My Workspace"'
          />
        </div>

        <div className="grid flex-shrink-0 grid-flow-row gap-2 px-6 pt-4">
          {!disabled && (
            <Button
              loading={isSubmitting}
              disabled={isSubmitting}
              type="submit"
            >
              {submitButtonText}
            </Button>
          )}

          <Button
            variant="outlined"
            color="secondary"
            onClick={onCancel}
            tabIndex={isDirty ? -1 : 0}
            autoFocus={disabled}
          >
            {disabled ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </Form>
    </FormProvider>
  );
}
