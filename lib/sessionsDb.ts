import { supabase } from "./supabaseClient";

export type TradeSession = {
  id: string;
  name: string;
  createdAt: string;
};

type SessionRow = {
  id: string;
  name: string;
  created_at: string;
};

const mapRow = (row: SessionRow): TradeSession => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
});

export const fetchSessions = async (userId: string): Promise<TradeSession[]> => {
  if (!supabase) throw new Error("Supabase не настроен");
  const { data, error } = await supabase
    .from("trade_sessions")
    .select("id,name,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
};

export const createSession = async (
  userId: string,
  name: string,
): Promise<TradeSession> => {
  if (!supabase) throw new Error("Supabase не настроен");
  const { data, error } = await supabase
    .from("trade_sessions")
    .insert({ user_id: userId, name })
    .select("id,name,created_at")
    .single();
  if (error) throw error;
  return mapRow(data);
};

export const fetchSessionById = async (
  userId: string,
  sessionId: string,
): Promise<TradeSession | null> => {
  if (!supabase) throw new Error("Supabase не настроен");
  const { data, error } = await supabase
    .from("trade_sessions")
    .select("id,name,created_at")
    .eq("user_id", userId)
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
};
