import { useEffect } from "react";
import { useGameStore } from "./store/gameStore";
import { useAccountStore } from "./store/accountStore";
import { useMultiplayerStore } from "./store/multiplayerStore";
import MainMenu from "./ui/MainMenu";
import LevelSelect from "./ui/LevelSelect";
import Game from "./game/Game";
import MobileControls from "./ui/MobileControls";
import AuthScreen from "./ui/AuthScreen";
import QuestsScreen from "./ui/QuestsScreen";
import FriendsScreen from "./ui/FriendsScreen";
import PracticeGame from "./ui/PracticeGame";
import LobbyScreen from "./ui/LobbyScreen";
import MultiplayerGame from "./ui/MultiplayerGame";
import XpBanner from "./ui/XpBanner";
import Leaderboard from "./ui/Leaderboard";
import WeeklyChallenges from "./ui/WeeklyChallenges";
import UpdateOverlay from "./ui/UpdateOverlay";
import BobBuddy from "./game/BobBuddy";
import JohnChat from "./ui/JohnChat";
import { useLiveConfigStore } from "./store/liveConfigStore";
import { useState } from "react";
import { startLevelValidator } from "./game/levelValidator";
import "./game-styles.css";

type Screen =
  | "menu" | "levelselect" | "playing" | "practice"
  | "auth" | "quests" | "friends" | "lobby" | "multiplayer"
  | "leaderboard" | "weekly";

export default function App() {
  const screen = useGameStore((s) => s.screen) as Screen;
  const setScreen = useGameStore((s) => s.setScreen);
  const restoreSession = useAccountStore((s) => s.restoreSession);
  const user = useAccountStore((s) => s.user);
  const token = useAccountStore((s) => s.token);
  const startHeartbeat = useAccountStore((s) => s.startHeartbeat);
  const stopHeartbeat = useAccountStore((s) => s.stopHeartbeat);
  const loadConfig = useLiveConfigStore((s) => s.load);
  const subscribeConfig = useLiveConfigStore((s) => s.subscribe);
  const [johnOpen, setJohnOpen] = useState(false);

  const lobbyId = useMultiplayerStore((s) => s.lobbyId);
  const lobbyLevel = useMultiplayerStore((s) => s.currentLevel);
  const connect = useMultiplayerStore((s) => s.connect);
  const disconnect = useMultiplayerStore((s) => s.disconnect);

  useEffect(() => {
    // Best-effort session restore. May fail if the backend is unreachable.
    restoreSession().catch(() => { /* ignore */ });
    // Kick off the daily AI level validator.
    startLevelValidator();
    // Load + subscribe to live config (BOB tips, physics overrides).
    loadConfig();
    const unsub = subscribeConfig();
    return () => { unsub(); };
  }, []);

  // Listen for a custom event from MainMenu to open John (mod-only).
  useEffect(() => {
    const h = () => setJohnOpen(true);
    window.addEventListener("mmm:open-john", h);
    return () => window.removeEventListener("mmm:open-john", h);
  }, []);

  // Autosave progress every 20 seconds when logged in.
  useEffect(() => {
    if (!token) return;
    const iv = setInterval(() => {
      const gs = useGameStore.getState();
      useAccountStore.getState().saveProgress({
        maxUnlocked: gs.maxUnlocked,
        completedLevels: Array.from(gs.completedLevels),
        deathsPerLevel: Object.fromEntries(
          Object.entries(gs.deathsPerLevel).map(([k, v]) => [k, v])
        ),
        totalDeaths: gs.totalDeaths,
      });
    }, 20000);
    return () => clearInterval(iv);
  }, [token]);

  useEffect(() => {
    if (token) {
      try { connect(token); } catch { /* ignore */ }
      startHeartbeat(token);
    } else {
      disconnect();
      stopHeartbeat();
    }
    return () => { stopHeartbeat(); };
  }, [token]);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#000" }}>
      {screen === "menu" && <MainMenu />}
      {screen === "levelselect" && <LevelSelect />}
      {screen === "auth" && <AuthScreen onBack={() => setScreen("menu")} />}
      {screen === "quests" && <QuestsScreen onBack={() => setScreen("menu")} />}
      {screen === "friends" && <FriendsScreen onBack={() => setScreen("menu")} />}
      {screen === "leaderboard" && <Leaderboard />}
      {screen === "weekly" && <WeeklyChallenges />}
      {screen === "lobby" && (
        <LobbyScreen
          onStart={() => setScreen("multiplayer")}
          onBack={() => setScreen("menu")}
        />
      )}
      {screen === "multiplayer" && lobbyId && (
        <MultiplayerGame
          lobbyId={lobbyId}
          startLevel={lobbyLevel}
          onExit={() => setScreen("lobby")}
        />
      )}
      {screen === "playing" && (
        <>
          <Game />
          <MobileControls />
        </>
      )}
      {screen === "practice" && (
        <>
          <PracticeGame onExit={() => setScreen("levelselect")} />
          <MobileControls />
        </>
      )}
      {/* Mobile controls also render in multiplayer (handled by MobileControls itself). */}
      {screen === "multiplayer" && <MobileControls />}
      <XpBanner />
      <BobBuddy />
      <UpdateOverlay />
      {johnOpen && user?.isModerator && <JohnChat onClose={() => setJohnOpen(false)} />}
    </div>
  );
}