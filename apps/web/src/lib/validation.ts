import { z } from "zod";
import type { MessageKey } from "@/lib/i18n/messages";

type T = (key: MessageKey) => string;

export function authLoginSchema(t: T) {
  return z.object({
    username: z.string().trim().min(1, t("validation.usernameRequired")),
    password: z.string().trim().min(1, t("validation.passwordRequired")),
  });
}

export function authRegisterSchema(t: T) {
  return authLoginSchema(t)
    .extend({
      email: z
        .string()
        .trim()
        .optional()
        .refine((value) => !value || value.includes("@"), t("validation.emailInvalid")),
      confirmPassword: z.string().trim().min(1, t("validation.passwordRequired")),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("validation.passwordMismatch"),
      path: ["confirmPassword"],
    });
}

export function createChannelSchema(t: T) {
  return z.object({
    channelName: z.string().trim().min(1, t("validation.channelNameRequired")),
    memberLimit: z
      .string()
      .trim()
      .refine((value) => Number(value) > 0, t("validation.memberLimitPositive")),
  });
}

export function uploadTrackSchema(t: T) {
  return z.object({
    trackTitle: z.string().trim().min(1, t("validation.trackTitleRequired")),
    trackFile: z.instanceof(File, { message: t("validation.audioFileRequired") }),
  });
}

export function createPlaylistSchema(t: T) {
  return z.object({
    playlistName: z.string().trim().min(1, t("validation.playlistNameRequired")),
  });
}

export function channelSettingsSchema(t: T) {
  return z.object({
    name: z.string().trim().min(1, t("validation.nameRequired")),
    memberLimit: z
      .string()
      .trim()
      .refine((value) => Number(value) > 0, t("validation.memberLimitPositive")),
  });
}
