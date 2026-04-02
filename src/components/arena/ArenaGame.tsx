"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ArenaBot,
  type ArenaEvent,
  type ArenaState,
  type HexCell,
  type HexKey,
  executeTurn,
  getGridBounds,
  hexKey,
  hexToPixel,
  initArena,
  parseHex,
} from "@/lib/arena-engine";

// ─── Animation Types ──────────────────────────────────────────────────

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface AttackAnimation {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  progress: number;
  success: boolean;
}

interface PulseAnimation {
  x: number;
  y: number;
  color: string;
  progress: number;
}

// ─── Constants ────────────────────────────────────────────────────────

const HEX_SIZE = 22;
const GRID_RADIUS = 7;
const BOT_COUNT = 8;
const SQRT3 = Math.sqrt(3);

// ─── Helper: Draw Hex ─────────────────────────────────────────────────

function drawHex(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  fillColor: string | null,
  strokeColor: string,
  lineWidth: number = 1,
) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

// ─── Main Component ───────────────────────────────────────────────────

export default function ArenaGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const gameStateRef = useRef<ArenaState | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const attackAnimsRef = useRef<AttackAnimation[]>([]);
  const pulseAnimsRef = useRef<PulseAnimation[]>([]);
  const turnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [gameState, setGameState] = useState<ArenaState | null>(null);
  const [events, setEvents] = useState<ArenaEvent[]>([]);
  const [speed, setSpeed] = useState<number>(3000); // ms per turn
  const [isRunning, setIsRunning] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [selectedBot, setSelectedBot] = useState<ArenaBot | null>(null);

  const speedRef = useRef(speed);
  const isRunningRef = useRef(isRunning);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  // ─── Initialize Game ──────────────────────────────────────────────

  const initGame = useCallback(() => {
    if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
    const state = initArena(BOT_COUNT, GRID_RADIUS, Date.now());
    gameStateRef.current = state;
    setGameState({ ...state });
    setEvents([]);
    setIsRunning(false);
    setSelectedBot(null);
    particlesRef.current = [];
    attackAnimsRef.current = [];
    pulseAnimsRef.current = [];
  }, []);

  // ─── Viewer Count Simulation ──────────────────────────────────────

  useEffect(() => {
    setViewerCount(Math.floor(Math.random() * 200) + 50);
    const interval = setInterval(() => {
      setViewerCount((v) => Math.max(30, v + Math.floor(Math.random() * 21) - 8));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // ─── Canvas Sizing ───────────────────────────────────────────────

  useEffect(() => {
    function handleResize() {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({
          width: Math.floor(rect.width),
          height: Math.floor(Math.min(rect.width * 0.7, window.innerHeight * 0.55)),
        });
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ─── Init on mount ───────────────────────────────────────────────

  useEffect(() => {
    initGame();
  }, [initGame]);

  // ─── Spawn Particles ──────────────────────────────────────────────

  const spawnParticles = useCallback(
    (x: number, y: number, color: string, count: number) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 2;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 0.5 + Math.random() * 0.5,
          color,
          size: 1.5 + Math.random() * 2.5,
        });
      }
    },
    [],
  );

  // ─── Execute Next Turn ────────────────────────────────────────────

  const doTurn = useCallback(() => {
    const state = gameStateRef.current;
    if (!state || state.gameOver) {
      setIsRunning(false);
      return;
    }

    const seed = Date.now() + state.turn * 7919;
    const turnEvents = executeTurn(state, seed);

    // Create visual effects for events
    for (const evt of turnEvents) {
      if (evt.targetCell) {
        const [q, r] = parseHex(evt.targetCell);
        const { x, y } = hexToPixel(q, r, HEX_SIZE);
        const cx = canvasSize.width / 2 + x;
        const cy = canvasSize.height / 2 + y;

        if (evt.type === "capture" || evt.type === "eliminate") {
          spawnParticles(cx, cy, evt.botColor, evt.type === "eliminate" ? 30 : 15);
          attackAnimsRef.current.push({
            fromX: cx - 20 + Math.random() * 40,
            fromY: cy - 20 + Math.random() * 40,
            toX: cx,
            toY: cy,
            color: evt.botColor,
            progress: 0,
            success: true,
          });
        } else if (evt.type === "defend") {
          pulseAnimsRef.current.push({
            x: cx,
            y: cy,
            color: evt.botColor,
            progress: 0,
          });
        } else if (evt.type === "expand") {
          pulseAnimsRef.current.push({
            x: cx,
            y: cy,
            color: evt.botColor,
            progress: 0,
          });
        }
      }
    }

    setGameState({ ...state, bots: [...state.bots] });
    setEvents((prev) => [...turnEvents, ...prev].slice(0, 50));

    // Schedule next turn
    if (!state.gameOver && isRunningRef.current) {
      turnTimerRef.current = setTimeout(doTurn, speedRef.current);
    }
  }, [canvasSize, spawnParticles]);

  // ─── Start/Pause ─────────────────────────────────────────────────

  const toggleRunning = useCallback(() => {
    if (gameStateRef.current?.gameOver) {
      initGame();
      return;
    }
    setIsRunning((prev) => {
      const next = !prev;
      if (next) {
        // Start
        setTimeout(doTurn, 300);
      } else {
        if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
      }
      return next;
    });
  }, [doTurn, initGame]);

  // ─── Cleanup ──────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // ─── Canvas Render Loop ───────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = 0;

    function render(time: number) {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const state = gameStateRef.current;
      if (!state || !ctx) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const W = canvasSize.width;
      const H = canvasSize.height;
      canvas!.width = W * window.devicePixelRatio;
      canvas!.height = H * window.devicePixelRatio;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

      // Clear
      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, W, H);

      const offsetX = W / 2;
      const offsetY = H / 2;

      // Draw grid
      for (const [key, cell] of state.grid) {
        const [q, r] = parseHex(key);
        const { x, y } = hexToPixel(q, r, HEX_SIZE);
        const cx = offsetX + x;
        const cy = offsetY + y;

        if (cell.owner) {
          const bot = state.bots.find((b) => b.id === cell.owner);
          if (bot) {
            const [cr, cg, cb] = bot.colorRgb;
            const alpha = cell.fortified ? 0.55 : 0.35;
            drawHex(ctx, cx, cy, HEX_SIZE - 1, `rgba(${cr},${cg},${cb},${alpha})`, `rgba(${cr},${cg},${cb},0.6)`, cell.fortified ? 2 : 1);

            // Fortification indicator
            if (cell.fortified) {
              drawHex(ctx, cx, cy, HEX_SIZE - 4, null, `rgba(${cr},${cg},${cb},0.3)`, 1);
            }
          }
        } else {
          // Empty cell
          const baseAlpha = cell.resource ? 0.15 : 0.04;
          drawHex(ctx, cx, cy, HEX_SIZE - 1, `rgba(39,39,42,${baseAlpha})`, "rgba(63,63,70,0.2)", 0.5);

          // Resource glow
          if (cell.resource) {
            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(250,204,21,${0.5 + Math.sin(time * 0.003) * 0.3})`;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx, cy, 7, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(250,204,21,0.1)`;
            ctx.fill();
          }
        }
      }

      // Draw bot base indicators (emoji text)
      ctx.font = `${HEX_SIZE * 0.9}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const bot of state.bots) {
        if (bot.eliminated) continue;
        const [bq, br] = parseHex(bot.baseCell);
        const { x, y } = hexToPixel(bq, br, HEX_SIZE);
        const cx = offsetX + x;
        const cy = offsetY + y;
        ctx.fillText(bot.emoji, cx, cy + 1);
      }

      // Update and draw particles
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // gravity
        p.life -= dt / p.maxLife;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.floor(p.life * 200).toString(16).padStart(2, "0");
        ctx.fill();
      }

      // Update and draw attack animations
      const attacks = attackAnimsRef.current;
      for (let i = attacks.length - 1; i >= 0; i--) {
        const a = attacks[i];
        a.progress += dt * 2;
        if (a.progress >= 1) {
          attacks.splice(i, 1);
          continue;
        }
        const t = a.progress;
        const lx = a.fromX + (a.toX - a.fromX) * t;
        const ly = a.fromY + (a.toY - a.fromY) * t;

        ctx.beginPath();
        ctx.moveTo(a.fromX, a.fromY);
        ctx.lineTo(lx, ly);
        ctx.strokeStyle = a.color + Math.floor((1 - t) * 200).toString(16).padStart(2, "0");
        ctx.lineWidth = 2 * (1 - t);
        ctx.stroke();

        // Projectile glow
        ctx.beginPath();
        ctx.arc(lx, ly, 3, 0, Math.PI * 2);
        ctx.fillStyle = a.color;
        ctx.fill();
      }

      // Update and draw pulse animations
      const pulses = pulseAnimsRef.current;
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.progress += dt * 1.5;
        if (p.progress >= 1) {
          pulses.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, HEX_SIZE * p.progress * 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = p.color + Math.floor((1 - p.progress) * 150).toString(16).padStart(2, "0");
        ctx.lineWidth = 2 * (1 - p.progress);
        ctx.stroke();
      }

      // Scanline effect (subtle)
      for (let y = 0; y < H; y += 4) {
        ctx.fillStyle = "rgba(0,0,0,0.03)";
        ctx.fillRect(0, y, W, 1);
      }

      animFrameRef.current = requestAnimationFrame(render);
    }

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [canvasSize]);

  // ─── Derived State ────────────────────────────────────────────────

  const aliveBots = gameState?.bots.filter((b) => !b.eliminated).sort((a, b) => b.territory - a.territory) ?? [];
  const eliminatedBots = gameState?.bots.filter((b) => b.eliminated).sort((a, b) => (b.eliminatedTurn ?? 0) - (a.eliminatedTurn ?? 0)) ?? [];

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Top Bar - LIVE indicator */}
      <div className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className={`absolute inline-flex h-full w-full rounded-full ${isRunning ? "animate-ping bg-red-400 opacity-75" : "bg-zinc-600"}`} />
                <span className={`relative inline-flex h-3 w-3 rounded-full ${isRunning ? "bg-red-500" : "bg-zinc-500"}`} />
              </span>
              <span className={`text-sm font-bold ${isRunning ? "text-red-400" : "text-zinc-500"}`}>
                {isRunning ? "LIVE" : gameState?.gameOver ? "ENDED" : "READY"}
              </span>
            </div>
            <span className="text-sm text-zinc-500">|</span>
            <span className="text-sm text-zinc-400">
              Territory Wars - Bot Arena
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-sm text-zinc-400">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              {viewerCount.toLocaleString()} watching
            </span>
            <span className="text-sm text-zinc-500">
              Turn {gameState?.turn ?? 0}/{gameState?.maxTurns ?? 0}
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          {/* Main Game Canvas */}
          <div className="space-y-3">
            <div
              ref={containerRef}
              className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30"
            >
              {/* Cinematic letterbox top */}
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-black/60 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-black/60 to-transparent" />

              <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                style={{ width: canvasSize.width, height: canvasSize.height }}
                className="block"
              />

              {/* Winner overlay */}
              {gameState?.gameOver && gameState.winner && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="text-center">
                    <div className="mb-2 text-5xl">{gameState.winner.emoji}</div>
                    <div className="text-3xl font-black text-white">{gameState.winner.emoji} {gameState.winner.name}</div>
                    <div className="mt-1 text-lg font-medium text-emerald-400">ARENA CHAMPION</div>
                    <div className="mt-1 text-sm text-zinc-400">
                      {gameState.winner.territory} territories | {gameState.winner.kills} eliminations
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleRunning}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                {gameState?.gameOver ? "New Game" : isRunning ? "Pause" : "Start"}
              </button>
              <button
                onClick={initGame}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Reset
              </button>

              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-zinc-500">Speed:</span>
                {[
                  { label: "Slow", ms: 4000 },
                  { label: "Normal", ms: 3000 },
                  { label: "Fast", ms: 1500 },
                  { label: "Turbo", ms: 600 },
                ].map((s) => (
                  <button
                    key={s.label}
                    onClick={() => setSpeed(s.ms)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                      speed === s.ms
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Event Feed */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Live Commentary
              </div>
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {events.length === 0 && (
                  <p className="text-sm text-zinc-600 italic">Press Start to begin the arena battle...</p>
                )}
                {events.map((evt, i) => (
                  <div
                    key={`${evt.turn}-${evt.type}-${evt.botId}-${i}`}
                    className={`flex items-start gap-2 rounded px-2 py-1 text-sm transition-colors ${
                      evt.dramatic
                        ? "bg-zinc-800/50 text-white"
                        : "text-zinc-400"
                    } ${i === 0 ? "arena-event-enter" : ""}`}
                  >
                    <span className="shrink-0 text-xs text-zinc-600 tabular-nums">
                      T{evt.turn}
                    </span>
                    <span
                      className="shrink-0 h-2 w-2 mt-1.5 rounded-full"
                      style={{ backgroundColor: evt.botColor }}
                    />
                    <span>{evt.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Leaderboard */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                Leaderboard
              </h3>
              <div className="space-y-1.5">
                {aliveBots.map((bot, i) => (
                  <button
                    key={bot.id}
                    onClick={() => setSelectedBot(selectedBot?.id === bot.id ? null : bot)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition ${
                      selectedBot?.id === bot.id
                        ? "bg-zinc-800 ring-1 ring-zinc-600"
                        : "hover:bg-zinc-800/50"
                    }`}
                  >
                    <span className="w-5 text-center text-xs font-bold text-zinc-600">
                      {i + 1}
                    </span>
                    <span className="text-base">{bot.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span
                          className="truncate text-sm font-medium"
                          style={{ color: bot.color }}
                        >
                          {bot.name}
                        </span>
                        <span className="text-xs tabular-nums text-zinc-400">
                          {bot.territory}
                        </span>
                      </div>
                      {/* HP + Energy bars */}
                      <div className="mt-1 flex gap-1">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-red-500/80 transition-all duration-500"
                            style={{ width: `${(bot.hp / bot.maxHp) * 100}%` }}
                          />
                        </div>
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-blue-500/80 transition-all duration-500"
                            style={{ width: `${(bot.energy / bot.maxEnergy) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Bot Detail */}
            {selectedBot && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-2xl">{selectedBot.emoji}</span>
                  <div>
                    <div className="font-semibold" style={{ color: selectedBot.color }}>
                      {selectedBot.name}
                    </div>
                    <div className="text-xs capitalize text-zinc-500">
                      {selectedBot.strategy} strategy
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-zinc-800/50 p-2">
                    <div className="text-zinc-500">HP</div>
                    <div className="font-mono font-bold text-red-400">
                      {selectedBot.hp}/{selectedBot.maxHp}
                    </div>
                  </div>
                  <div className="rounded-lg bg-zinc-800/50 p-2">
                    <div className="text-zinc-500">Energy</div>
                    <div className="font-mono font-bold text-blue-400">
                      {selectedBot.energy}/{selectedBot.maxEnergy}
                    </div>
                  </div>
                  <div className="rounded-lg bg-zinc-800/50 p-2">
                    <div className="text-zinc-500">Territory</div>
                    <div className="font-mono font-bold text-emerald-400">
                      {selectedBot.territory}
                    </div>
                  </div>
                  <div className="rounded-lg bg-zinc-800/50 p-2">
                    <div className="text-zinc-500">Kills</div>
                    <div className="font-mono font-bold text-amber-400">
                      {selectedBot.kills}
                    </div>
                  </div>
                  <div className="rounded-lg bg-zinc-800/50 p-2">
                    <div className="text-zinc-500">Attack</div>
                    <div className="font-mono font-bold text-rose-400">
                      {selectedBot.attackPower}
                    </div>
                  </div>
                  <div className="rounded-lg bg-zinc-800/50 p-2">
                    <div className="text-zinc-500">Defense</div>
                    <div className="font-mono font-bold text-cyan-400">
                      {selectedBot.defensePower}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Eliminated */}
            {eliminatedBots.length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                  Eliminated
                </h3>
                <div className="space-y-1">
                  {eliminatedBots.map((bot) => (
                    <div
                      key={bot.id}
                      className="flex items-center gap-2 rounded px-2 py-1 text-sm text-zinc-600"
                    >
                      <span className="grayscale">{bot.emoji}</span>
                      <span className="line-through">{bot.name}</span>
                      <span className="ml-auto text-xs">T{bot.eliminatedTurn}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Map Legend
              </h3>
              <div className="space-y-1.5 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full bg-yellow-400/50" />
                  Resource Node (+20 energy)
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded border-2 border-zinc-500" />
                  Fortified Cell (1.5x defense)
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-1 w-4 rounded bg-red-400" />
                  HP (health)
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-1 w-4 rounded bg-blue-400" />
                  Energy (actions)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
