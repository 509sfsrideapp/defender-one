"use client";

import { useEffect, useRef, useState } from "react";
import DeveloperBackLink from "../../components/DeveloperBackLink";

type ObstacleType = "car" | "barrier" | "cone";

type Obstacle = {
  id: number;
  lane: 0 | 1 | 2;
  y: number;
  type: ObstacleType;
  nearMissed?: boolean;
};

type GamePhase = "menu" | "playing" | "crashed";

type GameSnapshot = {
  phase: GamePhase;
  playerX: number;
  drift: number;
  speed: number;
  distance: number;
  score: number;
  elapsed: number;
  bac: number;
  reactionLag: number;
  controlRating: number;
  nearMisses: number;
  obstacles: Obstacle[];
  crashReason: string;
  bestScore: number;
};

type GameWorld = GameSnapshot & {
  input: number;
  brakeHeld: boolean;
  spawnIn: number;
  obstacleId: number;
  steeringVelocity: number;
};

const STORAGE_KEY = "driving-sim-best-score";
const LANE_CENTERS = [19, 50, 81] as const;
const PLAYER_ZONE_TOP = 70;
const PLAYER_ZONE_BOTTOM = 92;

const obstaclePalette: Record<ObstacleType, { body: string; glow: string; label: string }> = {
  car: {
    body: "linear-gradient(180deg, #f87171 0%, #7f1d1d 100%)",
    glow: "rgba(248, 113, 113, 0.35)",
    label: "Sedan",
  },
  barrier: {
    body: "linear-gradient(180deg, #f59e0b 0%, #7c2d12 100%)",
    glow: "rgba(251, 191, 36, 0.32)",
    label: "Barrier",
  },
  cone: {
    body: "linear-gradient(180deg, #fb923c 0%, #9a3412 100%)",
    glow: "rgba(251, 146, 60, 0.3)",
    label: "Cone",
  },
};

function loadBestScore() {
  if (typeof window === "undefined") {
    return 0;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function persistBestScore(value: number) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, String(Math.round(value)));
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString();
}

function createInitialWorld(bestScore = 0): GameWorld {
  return {
    phase: "menu",
    playerX: 50,
    drift: 0,
    speed: 48,
    distance: 0,
    score: 0,
    elapsed: 0,
    bac: 0.16,
    reactionLag: 420,
    controlRating: 18,
    nearMisses: 0,
    obstacles: [],
    crashReason: "",
    bestScore,
    input: 0,
    brakeHeld: false,
    spawnIn: 0.9,
    obstacleId: 1,
    steeringVelocity: 0,
  };
}

function getLaneCenter(lane: 0 | 1 | 2) {
  return LANE_CENTERS[lane];
}

function getCrashReason(obstacleType: ObstacleType) {
  if (obstacleType === "barrier") {
    return "You plowed into a roadside barrier.";
  }

  if (obstacleType === "cone") {
    return "You lost control and clipped the shoulder.";
  }

  return "You slammed into another vehicle.";
}

function DrivingSimHud({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div
      style={{
        padding: "0.75rem 0.9rem",
        borderRadius: 16,
        border: "1px solid rgba(148, 163, 184, 0.18)",
        background: "rgba(8, 14, 24, 0.82)",
        boxShadow: "0 12px 26px rgba(2, 6, 23, 0.18)",
      }}
    >
      <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7dd3fc" }}>
        {label}
      </p>
      <p
        style={{
          margin: "0.3rem 0 0",
          fontFamily: "var(--font-display)",
          fontSize: "1.2rem",
          letterSpacing: "0.06em",
          color: accent || "#f8fbff",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function renderObstacle(obstacle: Obstacle) {
  const palette = obstaclePalette[obstacle.type];
  const laneCenter = getLaneCenter(obstacle.lane);
  const scale = 0.72 + (obstacle.y / 100) * 0.56;
  const width = obstacle.type === "cone" ? 34 : obstacle.type === "barrier" ? 54 : 58;
  const height = obstacle.type === "cone" ? 44 : obstacle.type === "barrier" ? 38 : 82;

  return (
    <div
      key={obstacle.id}
      style={{
        position: "absolute",
        left: `${laneCenter}%`,
        top: `${obstacle.y}%`,
        transform: `translate(-50%, -50%) scale(${scale})`,
        width,
        height,
        borderRadius: obstacle.type === "cone" ? 18 : 16,
        background: palette.body,
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: `0 12px 30px ${palette.glow}`,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: obstacle.type === "cone" ? "12% 22%" : "12% 10%",
          borderRadius: obstacle.type === "cone" ? 14 : 12,
          border: "1px solid rgba(255,255,255,0.18)",
          opacity: 0.45,
        }}
      />
      <span
        style={{
          position: "relative",
          zIndex: 1,
          fontSize: obstacle.type === "cone" ? 8 : 9,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "rgba(255,255,255,0.86)",
          fontFamily: "var(--font-display)",
        }}
      >
        {palette.label}
      </span>
    </div>
  );
}

export default function DrivingSimClient() {
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() => createInitialWorld(loadBestScore()));
  const worldRef = useRef<GameWorld>(createInitialWorld(loadBestScore()));
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  function startGame() {
    const best = worldRef.current.bestScore || loadBestScore();
    const nextWorld = createInitialWorld(best);
    nextWorld.phase = "playing";
    worldRef.current = nextWorld;
    lastTimeRef.current = null;
    setSnapshot({ ...nextWorld });
  }

  useEffect(() => {
    worldRef.current.bestScore = loadBestScore();
    setSnapshot({ ...worldRef.current });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const world = worldRef.current;

      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        world.input = -1;
      }

      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        world.input = 1;
      }

      if (event.key === "ArrowDown" || event.key === " ") {
        event.preventDefault();
        world.brakeHeld = true;
      }

      if (event.key === "Enter" && world.phase !== "playing") {
        startGame();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const world = worldRef.current;

      if (
        (event.key === "ArrowLeft" || event.key.toLowerCase() === "a" || event.key === "ArrowRight" || event.key.toLowerCase() === "d") &&
        ((event.key === "ArrowLeft" || event.key.toLowerCase() === "a") ? world.input < 0 : world.input > 0)
      ) {
        world.input = 0;
      }

      if (event.key === "ArrowDown" || event.key === " ") {
        world.brakeHeld = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const tick = (now: number) => {
      if (lastTimeRef.current == null) {
        lastTimeRef.current = now;
      }

      const dt = Math.min(0.032, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;
      const world = worldRef.current;

      if (world.phase === "playing") {
        world.elapsed += dt;
        const distanceFactor = world.distance / 120;
        world.bac = Math.min(0.24, 0.16 + world.elapsed * 0.0028);
        world.reactionLag = Math.round(380 + world.bac * 820 + Math.sin(world.elapsed * 0.8) * 35);
        world.controlRating = Math.max(4, Math.round(28 - world.bac * 60 - world.elapsed * 0.42));

        const driftWave =
          Math.sin(world.elapsed * 1.55) * 4.6 +
          Math.sin(world.elapsed * 0.42 + 1.2) * 2.2 +
          Math.sin(world.elapsed * 3.1) * 0.95;
        world.drift = driftWave;

        const targetSteering = world.input * 18;
        world.steeringVelocity += (targetSteering - world.steeringVelocity) * dt * 1.9;
        world.playerX += (world.steeringVelocity + world.drift * 0.35) * dt;
        world.playerX = Math.max(13, Math.min(87, world.playerX));

        const targetSpeed = 45 + distanceFactor * 4.8;
        const brakePenalty = world.brakeHeld ? 26 : 0;
        world.speed += (targetSpeed - brakePenalty - world.speed) * dt * 2.1;
        world.distance += world.speed * dt * 0.88;
        world.score = world.distance + world.nearMisses * 65;

        world.spawnIn -= dt;
        if (world.spawnIn <= 0) {
          const obstacleTypePool: ObstacleType[] = ["car", "car", "barrier", "cone"];
          const type = obstacleTypePool[Math.floor(Math.random() * obstacleTypePool.length)];
          const lane = Math.floor(Math.random() * 3) as 0 | 1 | 2;
          world.obstacles.push({
            id: world.obstacleId,
            lane,
            y: -16,
            type,
          });
          world.obstacleId += 1;
          world.spawnIn = Math.max(0.38, 1.05 - world.speed / 120 + Math.random() * 0.35);
        }

        world.obstacles = world.obstacles
          .map((obstacle) => {
            const nextY = obstacle.y + world.speed * dt * (obstacle.type === "cone" ? 0.96 : 0.82);
            const laneCenter = getLaneCenter(obstacle.lane);
            const laneDistance = Math.abs(world.playerX - laneCenter);

            if (!obstacle.nearMissed && nextY > PLAYER_ZONE_BOTTOM + 5 && laneDistance > 8 && laneDistance < 20) {
              obstacle.nearMissed = true;
              world.nearMisses += 1;
              world.score += 40;
            }

            if (nextY > PLAYER_ZONE_TOP && nextY < PLAYER_ZONE_BOTTOM && laneDistance < (obstacle.type === "cone" ? 8 : 11)) {
              world.phase = "crashed";
              world.crashReason = getCrashReason(obstacle.type);
              world.bestScore = Math.max(world.bestScore, world.score);
              persistBestScore(world.bestScore);

              if (typeof window !== "undefined" && "vibrate" in navigator) {
                navigator.vibrate?.([100, 40, 120]);
              }
            }

            return { ...obstacle, y: nextY };
          })
          .filter((obstacle) => obstacle.y < 120);
      }

      setSnapshot({
        phase: world.phase,
        playerX: world.playerX,
        drift: world.drift,
        speed: world.speed,
        distance: world.distance,
        score: world.score,
        elapsed: world.elapsed,
        bac: world.bac,
        reactionLag: world.reactionLag,
        controlRating: world.controlRating,
        nearMisses: world.nearMisses,
        obstacles: world.obstacles,
        crashReason: world.crashReason,
        bestScore: world.bestScore,
      });

      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current != null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const setInput = (direction: number) => {
    worldRef.current.input = direction;
  };

  const setBrake = (value: boolean) => {
    worldRef.current.brakeHeld = value;
  };

  const impairmentBlur = Math.min(7, 1.4 + snapshot.bac * 18);
  const distortionRotation = Math.sin(snapshot.elapsed * 0.55) * 0.9;

  return (
    <main style={{ padding: 20 }}>
      <DeveloperBackLink />

      <section
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "clamp(1rem, 2vw, 1.4rem)",
          borderRadius: 28,
          border: "1px solid rgba(96, 165, 250, 0.18)",
          background:
            "radial-gradient(circle at top, rgba(37, 99, 235, 0.16), transparent 24%), linear-gradient(180deg, rgba(7, 12, 22, 0.98) 0%, rgba(2, 5, 10, 0.99) 100%)",
          boxShadow: "0 28px 80px rgba(2, 6, 23, 0.42)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 18,
            flexWrap: "wrap",
            alignItems: "flex-start",
            marginBottom: 18,
          }}
        >
          <div style={{ maxWidth: 620 }}>
            <p style={{ margin: 0, color: "#7dd3fc", letterSpacing: "0.16em", textTransform: "uppercase", fontSize: 12 }}>
              Dev Prototype
            </p>
            <h1 style={{ margin: "0.45rem 0 0.65rem" }}>Impairment Driving Simulator</h1>
            <p style={{ margin: 0, color: "#cbd5e1", maxWidth: 620 }}>
              A dev-only awareness sim built to show how fast control, reaction, and judgment collapse under impairment. Stay alive as long as you can, but the point is that the run gets ugly fast.
            </p>
          </div>

          <div
            style={{
              minWidth: 240,
              padding: 16,
              borderRadius: 20,
              border: "1px solid rgba(148, 163, 184, 0.16)",
              background: "rgba(8, 14, 24, 0.78)",
            }}
          >
            <p style={{ margin: 0, color: "#7dd3fc", letterSpacing: "0.14em", textTransform: "uppercase", fontSize: 12 }}>
              Controls
            </p>
            <p style={{ margin: "0.6rem 0 0", color: "#e2e8f0" }}>A / Left: steer left</p>
            <p style={{ margin: "0.2rem 0 0", color: "#e2e8f0" }}>D / Right: steer right</p>
            <p style={{ margin: "0.2rem 0 0", color: "#e2e8f0" }}>Down / Space: brake</p>
            <p style={{ margin: "0.2rem 0 0", color: "#94a3b8", fontSize: 13 }}>Mobile buttons are built in below the road.</p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 310px",
            gap: 18,
          }}
        >
          <div
            style={{
              position: "relative",
              minHeight: 700,
              overflow: "hidden",
              borderRadius: 28,
              border: "1px solid rgba(148, 163, 184, 0.16)",
              background:
                "radial-gradient(circle at 50% 8%, rgba(96, 165, 250, 0.24), transparent 20%), linear-gradient(180deg, #0a1020 0%, #05070d 100%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(125, 211, 252, 0.14), transparent 18%), radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.08), transparent 60%)",
                pointerEvents: "none",
              }}
            />

            <div
              style={{
                position: "absolute",
                inset: "7% 8% 13%",
                borderRadius: 28,
                overflow: "hidden",
                transform: `perspective(880px) rotateX(61deg) rotateZ(${distortionRotation}deg)`,
                transformOrigin: "center bottom",
                boxShadow: `0 18px 42px rgba(2, 6, 23, 0.5), 0 0 0 1px rgba(148, 163, 184, 0.12) inset`,
                background:
                  "linear-gradient(180deg, rgba(2, 6, 12, 0.98) 0%, rgba(14, 19, 28, 0.98) 10%, rgba(18, 25, 36, 0.98) 100%)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    `repeating-linear-gradient(180deg, transparent 0 3.4%, rgba(255,255,255,0.9) 3.4% 4.3%, transparent 4.3% 12%)`,
                  backgroundSize: "100% 140%",
                  backgroundPositionY: `${snapshot.distance * 1.8}px`,
                  opacity: 0.72,
                  mixBlendMode: "screen",
                }}
              />

              {[33.33, 66.66].map((divider, index) => (
                <div
                  key={divider}
                  style={{
                    position: "absolute",
                    top: "-8%",
                    bottom: "-8%",
                    left: `${divider}%`,
                    width: index === 0 ? 4 : 3,
                    background: "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.4) 12%, rgba(255,255,255,0.2) 88%, transparent 100%)",
                    opacity: 0.26,
                  }}
                />
              ))}

              <div
                style={{
                  position: "absolute",
                  inset: "-2%",
                  borderRadius: 32,
                  border: "1px solid rgba(96, 165, 250, 0.12)",
                  boxShadow: `0 0 ${12 + impairmentBlur * 2}px rgba(59, 130, 246, 0.14) inset`,
                  backdropFilter: `blur(${impairmentBlur}px)`,
                  opacity: 0.2,
                  pointerEvents: "none",
                }}
              />

              {snapshot.obstacles.map((obstacle) => renderObstacle(obstacle))}

              <div
                style={{
                  position: "absolute",
                  left: `${snapshot.playerX}%`,
                  top: "78%",
                  transform: `translate(-50%, -50%) rotate(${snapshot.drift * 0.55}deg)`,
                  width: 74,
                  height: 122,
                  zIndex: 3,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: "0 0 0 0",
                    borderRadius: 22,
                    background: "linear-gradient(180deg, #dbeafe 0%, #60a5fa 12%, #0f172a 28%, #020617 100%)",
                    border: "1px solid rgba(255,255,255,0.16)",
                    boxShadow: "0 16px 36px rgba(59, 130, 246, 0.34)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: "8px 10px auto",
                    height: 20,
                    borderRadius: 999,
                    background: "rgba(191, 219, 254, 0.82)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: "38px 8px 12px",
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "linear-gradient(180deg, rgba(30, 41, 59, 0.96) 0%, rgba(15, 23, 42, 0.98) 100%)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 8,
                    right: 8,
                    bottom: -12,
                    height: 18,
                    borderRadius: 999,
                    background: "radial-gradient(circle, rgba(59,130,246,0.36), transparent 65%)",
                    filter: "blur(8px)",
                  }}
                />
              </div>
            </div>

            {snapshot.phase !== "playing" ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  padding: 24,
                  background: "linear-gradient(180deg, rgba(2, 6, 23, 0.28) 0%, rgba(2, 6, 23, 0.72) 100%)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <div
                  style={{
                    width: "min(100%, 35rem)",
                    padding: "1.6rem",
                    borderRadius: 26,
                    border: "1px solid rgba(148, 163, 184, 0.16)",
                    background: "rgba(5, 10, 18, 0.94)",
                    boxShadow: "0 24px 56px rgba(2, 6, 23, 0.44)",
                  }}
                >
                  {snapshot.phase === "menu" ? (
                    <>
                      <p style={{ margin: 0, color: "#fca5a5", letterSpacing: "0.15em", textTransform: "uppercase", fontSize: 12 }}>
                        Awareness Prototype
                      </p>
                      <h2 style={{ margin: "0.55rem 0 0.8rem" }}>Every second gets less controllable</h2>
                      <p style={{ margin: 0, color: "#cbd5e1" }}>
                        The road drifts, reaction time stretches, and staying in lane gets harder the longer the run goes. This isn’t a power fantasy. It’s a failure spiral.
                      </p>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 18 }}>
                        <DrivingSimHud label="Starting BAC" value="0.16" accent="#fecaca" />
                        <DrivingSimHud label="Reaction Delay" value="420 ms" accent="#fde68a" />
                        <DrivingSimHud label="Best Run" value={`${formatNumber(snapshot.bestScore)} pts`} accent="#bfdbfe" />
                      </div>

                      <button
                        type="button"
                        onClick={startGame}
                        style={{
                          width: "100%",
                          marginTop: 18,
                          minHeight: 56,
                          borderRadius: 18,
                          background: "linear-gradient(180deg, rgba(37, 99, 235, 0.96) 0%, rgba(30, 64, 175, 0.98) 100%)",
                        }}
                      >
                        Start Simulation
                      </button>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: 0, color: "#fca5a5", letterSpacing: "0.15em", textTransform: "uppercase", fontSize: 12 }}>
                        Run Ended
                      </p>
                      <h2 style={{ margin: "0.55rem 0 0.8rem" }}>{snapshot.crashReason}</h2>
                      <p style={{ margin: 0, color: "#cbd5e1" }}>
                        Final score: <strong>{formatNumber(snapshot.score)}</strong> points after{" "}
                        <strong>{snapshot.elapsed.toFixed(1)}s</strong>. Best run: <strong>{formatNumber(snapshot.bestScore)}</strong>.
                      </p>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 18 }}>
                        <DrivingSimHud label="Distance" value={`${formatNumber(snapshot.distance)} m`} accent="#bfdbfe" />
                        <DrivingSimHud label="Near Misses" value={String(snapshot.nearMisses)} accent="#c4b5fd" />
                        <DrivingSimHud label="Peak BAC" value={snapshot.bac.toFixed(2)} accent="#fecaca" />
                      </div>

                      <button
                        type="button"
                        onClick={startGame}
                        style={{
                          width: "100%",
                          marginTop: 18,
                          minHeight: 56,
                          borderRadius: 18,
                          background: "linear-gradient(180deg, rgba(15, 118, 110, 0.96) 0%, rgba(17, 94, 89, 0.98) 100%)",
                        }}
                      >
                        Run It Again
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : null}

            <div
              style={{
                position: "absolute",
                left: 18,
                right: 18,
                bottom: 18,
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              <button
                type="button"
                onPointerDown={() => setInput(-1)}
                onPointerUp={() => setInput(0)}
                onPointerLeave={() => setInput(0)}
                onTouchEnd={() => setInput(0)}
                style={{
                  minHeight: 58,
                  borderRadius: 18,
                  background: "rgba(8, 15, 28, 0.88)",
                  border: "1px solid rgba(125, 211, 252, 0.16)",
                }}
              >
                Steer Left
              </button>
              <button
                type="button"
                onPointerDown={() => setBrake(true)}
                onPointerUp={() => setBrake(false)}
                onPointerLeave={() => setBrake(false)}
                onTouchEnd={() => setBrake(false)}
                style={{
                  minHeight: 58,
                  borderRadius: 18,
                  background: "rgba(69, 10, 10, 0.82)",
                  border: "1px solid rgba(248, 113, 113, 0.16)",
                }}
              >
                Brake
              </button>
              <button
                type="button"
                onPointerDown={() => setInput(1)}
                onPointerUp={() => setInput(0)}
                onPointerLeave={() => setInput(0)}
                onTouchEnd={() => setInput(0)}
                style={{
                  minHeight: 58,
                  borderRadius: 18,
                  background: "rgba(8, 15, 28, 0.88)",
                  border: "1px solid rgba(125, 211, 252, 0.16)",
                }}
              >
                Steer Right
              </button>
            </div>
          </div>

          <aside
            style={{
              display: "grid",
              gap: 14,
              alignContent: "start",
            }}
          >
            <DrivingSimHud label="Score" value={`${formatNumber(snapshot.score)} pts`} accent="#f8fbff" />
            <DrivingSimHud label="Distance" value={`${formatNumber(snapshot.distance)} m`} accent="#bfdbfe" />
            <DrivingSimHud label="Speed" value={`${snapshot.speed.toFixed(0)} mph`} accent="#fef08a" />
            <DrivingSimHud label="BAC" value={snapshot.bac.toFixed(2)} accent="#fecaca" />
            <DrivingSimHud label="Reaction Delay" value={`${snapshot.reactionLag} ms`} accent="#fde68a" />
            <DrivingSimHud label="Control" value={`${snapshot.controlRating}%`} accent="#fca5a5" />
            <DrivingSimHud label="Near Misses" value={String(snapshot.nearMisses)} accent="#c4b5fd" />
            <DrivingSimHud label="Best Run" value={`${formatNumber(snapshot.bestScore)} pts`} accent="#86efac" />

            <div
              style={{
                padding: 18,
                borderRadius: 20,
                border: "1px solid rgba(148, 163, 184, 0.18)",
                background: "rgba(8, 14, 24, 0.82)",
                boxShadow: "0 12px 28px rgba(2, 6, 23, 0.18)",
              }}
            >
              <p style={{ margin: 0, color: "#7dd3fc", letterSpacing: "0.14em", textTransform: "uppercase", fontSize: 12 }}>
                Why it works
              </p>
              <p style={{ margin: "0.65rem 0 0", color: "#cbd5e1" }}>
                The car is always fighting you. Even when you stop steering, the impairment drift keeps pulling the run off center. The longer you survive, the less recoverable it becomes.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
