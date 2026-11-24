"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  ParticipantTile,
  TrackToggle,
  StartAudio,
  useTracks,
  useParticipants,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";
import st from "./lessons.module.css";
function Stage({ leave }: { leave: () => void }) {
  const { t: tr } = useJupLocale();

  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);
  const participants = useParticipants();
  return (
    <>
      <div className={st.row}>
        <strong>
          {tr("На встрече · ")}
          {participants.length}
        </strong>
        <button onClick={leave}>{tr("Выйти из звонка")}</button>
      </div>
      <div className={st.videoGrid}>
        {tracks.map((t) => (
          <ParticipantTile
            key={t.participant.identity + t.source}
            trackRef={t}
          />
        ))}
      </div>
      <div className={st.actions}>
        <TrackToggle source={Track.Source.Microphone}>
          {tr("Микрофон")}
        </TrackToggle>
        <TrackToggle source={Track.Source.Camera}>{tr("Камера")}</TrackToggle>
        {typeof navigator.mediaDevices?.getDisplayMedia === "function" && (
          <TrackToggle source={Track.Source.ScreenShare}>
            {tr("Показ экрана")}
          </TrackToggle>
        )}
        <StartAudio label={tr("Включить звук участников")} />
      </div>
      <RoomAudioRenderer />
    </>
  );
}
export default function VideoCall({
  ticket,
  leave,
  onError,
}: {
  ticket: { url: string; token: string };
  leave: () => void;
  onError: (e: Error) => void;
}) {
  return (
    <LiveKitRoom
      data-lk-theme="default"
      className={st.call}
      serverUrl={ticket.url}
      token={ticket.token}
      connect
      audio={false}
      video={false}
      onDisconnected={leave}
      onError={onError}
      onMediaDeviceFailure={() =>
        onError(
          new Error(
            "Не удалось включить устройство. Проверьте разрешение на камеру или микрофон в браузере.",
          ),
        )
      }
    >
      <Stage leave={leave} />
    </LiveKitRoom>
  );
}
