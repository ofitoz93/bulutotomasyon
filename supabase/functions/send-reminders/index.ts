// Supabase Edge Function: send-reminders
// Açık aksiyonlar için hatırlatma e-postalarını kuyruğa ekler ve gönderir
// Cron ile her gün saat 10:00'da çağrılmalıdır

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.7";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// SMTP Ayarları
const SMTP_USER = "o.fitoz93@gmail.com";
const SMTP_PASS = "ntdkqyplkjzbzxoc";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Hatırlatma e-postalarını kuyruğa ekle
        let totalQueued = 0;

        // 1a. Aksiyonlar
        const { data: actionCount, error: actionRpcError } = await supabase.rpc('queue_action_reminders');
        if (actionRpcError) throw actionRpcError;
        totalQueued += (actionCount || 0);

        // 1b. Evrak Takip
        const { data: documentCount, error: docRpcError } = await supabase.rpc('queue_document_reminders');
        if (docRpcError) throw docRpcError;
        totalQueued += (documentCount || 0);

        console.log(`${totalQueued} hatırlatma e-postası kuyruğa eklendi. (Aksiyonlar: ${actionCount || 0}, Evraklar: ${documentCount || 0})`);

        // 2. Kuyruktaki pending e-postaları gönder
        const { data: emails, error } = await supabase
            .from("notification_queue")
            .select("*")
            .eq("status", "pending")
            .order("created_at")
            .limit(50);

        if (error) throw error;
        if (!emails || emails.length === 0) {
            return new Response(
                JSON.stringify({ message: "Gönderilecek hatırlatma yok", queued: totalQueued }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
        });

        let sentCount = 0;
        for (const email of emails) {
            try {
                await transporter.sendMail({
                    from: `"Bulut Otomasyon" <${SMTP_USER}>`,
                    to: email.to_email,
                    subject: email.subject,
                    html: email.body_html,
                });

                await supabase
                    .from("notification_queue")
                    .update({ status: "sent", sent_at: new Date().toISOString() })
                    .eq("id", email.id);
                sentCount++;
            } catch (sendErr: any) {
                console.error(`Gönderilemedi (${email.to_email}):`, sendErr.message);
                await supabase
                    .from("notification_queue")
                    .update({ status: "failed" })
                    .eq("id", email.id);
            }
        }

        return new Response(
            JSON.stringify({
                message: `${totalQueued} hatırlatma kuyruğa eklendi, ${sentCount}/${emails.length} e-posta gönderildi`
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (err: any) {
        console.error("Reminder Error:", err);
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
