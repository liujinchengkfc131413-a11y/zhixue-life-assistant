import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import masterFrame from '../../../assets/today/scene-video/today-scene-master-frame.webp';
import { FOUNTAIN_SCENE_VIDEO_SOURCES, type FountainSceneState } from './fountain-scene-state.js';

const CROSSFADE_DURATION_MS = 1500;
type VideoSlot = 0 | 1;

interface MediaLayer {
  readonly state?: FountainSceneState | undefined;
  readonly src?: string | undefined;
}

const emptyLayers = (): [MediaLayer, MediaLayer] => [{}, {}];

const playSilently = async (video: HTMLVideoElement): Promise<boolean> => {
  try {
    await video.play();
    return true;
  } catch {
    return false;
  }
};

const syncNormalizedPhase = (current: HTMLVideoElement, next: HTMLVideoElement): void => {
  if (!Number.isFinite(current.duration) || current.duration <= 0) return;
  if (!Number.isFinite(next.duration) || next.duration <= 0) return;
  const progress = (current.currentTime % current.duration) / current.duration;
  next.currentTime = Math.min(next.duration - 1 / 24, Math.max(0, next.duration * progress));
};

export const TodaySceneMedia = ({
  pressureState,
}: {
  readonly pressureState?: FountainSceneState | undefined;
}) => {
  const target = useMemo(
    () =>
      pressureState === undefined
        ? undefined
        : { state: pressureState, videoSrc: FOUNTAIN_SCENE_VIDEO_SOURCES[pressureState] },
    [pressureState],
  );
  const [layers, setLayers] = useState<[MediaLayer, MediaLayer]>(() => {
    const initial = emptyLayers();
    if (target !== undefined) initial[0] = { state: target.state, src: target.videoSrc };
    return initial;
  });
  const [visibleSlot, setVisibleSlot] = useState<VideoSlot | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const videoRefs = useRef<[HTMLVideoElement | null, HTMLVideoElement | null]>([null, null]);
  const layersRef = useRef(layers);
  const visibleSlotRef = useRef<VideoSlot | null>(null);
  const transitioningRef = useRef(false);
  const queuedStateRef = useRef<FountainSceneState | undefined>(undefined);
  const targetStateRef = useRef<FountainSceneState | undefined>(target?.state);
  const reducedMotionRef = useRef(false);
  const transitionTimerRef = useRef<number | undefined>(undefined);
  const preloadTimerRef = useRef<number | undefined>(undefined);
  const preloadersRef = useRef<HTMLVideoElement[]>([]);

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  const assignLayer = useCallback((slot: VideoSlot, state: FountainSceneState) => {
    const nextLayer = { state, src: FOUNTAIN_SCENE_VIDEO_SOURCES[state] };
    layersRef.current = layersRef.current.map((layer, index) =>
      index === slot ? nextLayer : layer,
    ) as [MediaLayer, MediaLayer];
    setLayers(layersRef.current);
  }, []);

  const requestState = useCallback(
    (state: FountainSceneState) => {
      targetStateRef.current = state;
      if (reducedMotionRef.current) return;
      if (transitioningRef.current) {
        queuedStateRef.current = state;
        return;
      }
      const activeSlot = visibleSlotRef.current;
      if (activeSlot === null) {
        if (layersRef.current[0].state !== state) assignLayer(0, state);
        return;
      }
      if (layersRef.current[activeSlot].state === state) return;
      const standbySlot: VideoSlot = activeSlot === 0 ? 1 : 0;
      assignLayer(standbySlot, state);
    },
    [assignLayer],
  );

  const preloadRemainingStates = useCallback((activeState: FountainSceneState) => {
    if (preloadTimerRef.current !== undefined) window.clearTimeout(preloadTimerRef.current);
    preloadTimerRef.current = window.setTimeout(() => {
      preloadTimerRef.current = undefined;
      preloadersRef.current.forEach((video) => {
        video.removeAttribute('src');
        video.load();
      });
      preloadersRef.current = (Object.keys(FOUNTAIN_SCENE_VIDEO_SOURCES) as FountainSceneState[])
        .filter((state) => state !== activeState)
        .map((state) => {
          const video = document.createElement('video');
          video.muted = true;
          video.preload = 'auto';
          video.src = FOUNTAIN_SCENE_VIDEO_SOURCES[state];
          video.load();
          return video;
        });
    }, 800);
  }, []);

  const handleCanPlay = useCallback(
    (slot: VideoSlot) => {
      const video = videoRefs.current[slot];
      const layer = layersRef.current[slot];
      const layerState = layer.state;
      if (
        video === null ||
        layerState === undefined ||
        reducedMotionRef.current ||
        targetStateRef.current !== layerState
      )
        return;

      const activeSlot = visibleSlotRef.current;
      if (activeSlot === null) {
        void playSilently(video).then((played) => {
          if (!played || reducedMotionRef.current || targetStateRef.current !== layerState) return;
          visibleSlotRef.current = slot;
          setVisibleSlot(slot);
          preloadRemainingStates(layerState);
        });
        return;
      }
      if (activeSlot === slot || transitioningRef.current) return;

      const currentVideo = videoRefs.current[activeSlot];
      if (currentVideo === null) return;
      syncNormalizedPhase(currentVideo, video);
      void playSilently(video).then((played) => {
        if (!played || reducedMotionRef.current || targetStateRef.current !== layerState) return;
        const previousSlot = activeSlot;
        transitioningRef.current = true;
        setTransitioning(true);
        visibleSlotRef.current = slot;
        setVisibleSlot(slot);
        if (transitionTimerRef.current !== undefined)
          window.clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = window.setTimeout(() => {
          videoRefs.current[previousSlot]?.pause();
          transitioningRef.current = false;
          setTransitioning(false);
          const queuedState = queuedStateRef.current;
          queuedStateRef.current = undefined;
          if (queuedState !== undefined && queuedState !== layersRef.current[slot].state)
            requestState(queuedState);
        }, CROSSFADE_DURATION_MS);
      });
    },
    [preloadRemainingStates, requestState],
  );

  const handleError = useCallback((slot: VideoSlot) => {
    if (visibleSlotRef.current !== slot) return;
    videoRefs.current[slot]?.pause();
    visibleSlotRef.current = null;
    setVisibleSlot(null);
  }, []);

  useEffect(() => {
    targetStateRef.current = target?.state;
    if (target !== undefined) requestState(target.state);
  }, [requestState, target]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      reducedMotionRef.current = query.matches;
      setReducedMotion(query.matches);
      if (query.matches) {
        if (transitionTimerRef.current !== undefined)
          window.clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = undefined;
        transitioningRef.current = false;
        setTransitioning(false);
        videoRefs.current.forEach((video) => {
          video?.pause();
        });
        visibleSlotRef.current = null;
        setVisibleSlot(null);
      } else if (targetStateRef.current !== undefined) {
        requestState(targetStateRef.current);
        const firstLayer = layersRef.current.findIndex(
          (layer) => layer.state === targetStateRef.current,
        ) as VideoSlot | -1;
        if (firstLayer !== -1) {
          const video = videoRefs.current[firstLayer];
          if (video !== null && video.readyState >= 3) handleCanPlay(firstLayer);
        }
      }
    };
    update();
    query.addEventListener('change', update);
    return () => {
      query.removeEventListener('change', update);
    };
  }, [handleCanPlay, requestState]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        videoRefs.current.forEach((video) => {
          video?.pause();
        });
        return;
      }
      if (reducedMotionRef.current) return;
      const activeSlot = visibleSlotRef.current;
      if (activeSlot !== null) {
        const activeVideo = videoRefs.current[activeSlot];
        if (activeVideo !== null) void playSilently(activeVideo);
      }
      if (transitioningRef.current && activeSlot !== null) {
        const otherSlot: VideoSlot = activeSlot === 0 ? 1 : 0;
        const otherVideo = videoRefs.current[otherSlot];
        if (otherVideo !== null) void playSilently(otherVideo);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(
    () => () => {
      if (transitionTimerRef.current !== undefined) window.clearTimeout(transitionTimerRef.current);
      if (preloadTimerRef.current !== undefined) window.clearTimeout(preloadTimerRef.current);
      videoRefs.current.forEach((video) => {
        video?.pause();
      });
      preloadersRef.current.forEach((video) => {
        video.removeAttribute('src');
        video.load();
      });
    },
    [],
  );

  return (
    <div
      className="today-scene-media"
      data-scene-state={target?.state}
      data-active-state={visibleSlot === null ? undefined : layers[visibleSlot].state}
      data-media-ready={visibleSlot !== null}
      data-transitioning={transitioning}
      data-reduced-motion={reducedMotion}
      aria-hidden="true"
    >
      <img className="today-scene-media__master" src={masterFrame} alt="" />
      {layers.map((layer, index) => {
        const slot = index as VideoSlot;
        return (
          <video
            key={slot}
            ref={(node) => {
              videoRefs.current[slot] = node;
            }}
            className="today-scene-media__video"
            data-video-slot={slot === 0 ? 'a' : 'b'}
            data-video-state={layer.state}
            data-visible={visibleSlot === slot && !reducedMotion}
            src={layer.src}
            muted
            playsInline
            loop
            preload="auto"
            controls={false}
            disablePictureInPicture
            tabIndex={-1}
            onCanPlay={() => {
              handleCanPlay(slot);
            }}
            onError={() => {
              handleError(slot);
            }}
          />
        );
      })}
    </div>
  );
};
