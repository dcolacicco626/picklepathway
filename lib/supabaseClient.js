// /lib/supabaseClient.js
"use client";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// This client reads/writes the Supabase session via cookies that middleware/route handlers can see.
export const supabase = createClientComponentClient();
