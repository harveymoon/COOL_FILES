// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { type VariantProps, cva } from 'class-variance-authority';

export { default as Button } from './button.vue';
export { default as ConfirmButton } from './confirm-button.vue';

export const buttonVariants = cva(
  'cool-files-ui-button',
  {
    variants: {
      variant: {
        default: 'cool-files-ui-button--default',
        destructive: 'cool-files-ui-button--destructive',
        outline: 'cool-files-ui-button--outline',
        secondary: 'cool-files-ui-button--secondary',
        tertiary: 'cool-files-ui-button--tertiary',
        ghost: 'cool-files-ui-button--ghost',
        link: 'cool-files-ui-button--link',
      },
      size: {
        default: 'cool-files-ui-button--size-default',
        xs: 'cool-files-ui-button--size-xs',
        sm: 'cool-files-ui-button--size-sm',
        lg: 'cool-files-ui-button--size-lg',
        icon: 'cool-files-ui-button--size-icon',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
