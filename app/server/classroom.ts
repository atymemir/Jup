import { AccessToken } from "livekit-server-sdk";

export const classroomActions = [
  "publish_series",
  "student_name",
  "save_room",
  "send_work",
  "review_work",
  "propose_move",
  "accept_move",
  "dismiss_move",
  "video_access",
  "read_chat",
  "calendar_enable",
  "calendar_disable",
];
export function videoConfigured() {
  return Boolean(
    process.env.FINDBUDDY_VIDEO_URL &&
      process.env.FINDBUDDY_VIDEO_KEY &&
      process.env.FINDBUDDY_VIDEO_SECRET,
  );
}

export async function videoTicket(access: {
  identity: string;
  room: string;
  name: string;
}) {
  if (!videoConfigured())
    throw Error(
      "Видеосвязь пока не подключена. Используйте ссылку преподавателя.",
    );
  const token = new AccessToken(
    process.env.FINDBUDDY_VIDEO_KEY,
    process.env.FINDBUDDY_VIDEO_SECRET,
    { identity: access.identity, name: access.name, ttl: "3m" },
  );
  token.addGrant({
    roomJoin: true,
    room: "fb-" + access.room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
  });
  return { url: process.env.FINDBUDDY_VIDEO_URL, token: await token.toJwt() };
}
