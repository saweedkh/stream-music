import { z } from "zod";

export const authLoginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().trim().min(1, "Password is required"),
});

export const authRegisterSchema = authLoginSchema.extend({
  email: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || value.includes("@"), "Email format is invalid"),
});

export const createChannelSchema = z.object({
  channelName: z.string().trim().min(1, "Channel name is required"),
  memberLimit: z
    .string()
    .trim()
    .refine((value) => Number(value) > 0, "Member limit must be greater than zero"),
});

export const uploadTrackSchema = z.object({
  trackTitle: z.string().trim().min(1, "Track title is required"),
  trackFile: z.instanceof(File, { message: "Audio file is required" }),
});

export const createPlaylistSchema = z.object({
  playlistName: z.string().trim().min(1, "Playlist name is required"),
});

export const channelSettingsSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  memberLimit: z
    .string()
    .trim()
    .refine((value) => Number(value) > 0, "Member limit must be greater than zero"),
});

