# Bot de Discord VANTS — configuración

El bot funciona sin servidor propio: Discord envía los comandos a la Edge Function
`discord-commands` y la base de datos publica los avisos con `discord-notify`.

## 1. Portal de desarrolladores de Discord

1. Abre la aplicación del bot en https://discord.com/developers/applications
2. **General Information → Interactions Endpoint URL**:
   `https://qtetsgwwsvqzquxssudj.supabase.co/functions/v1/discord-commands`
   (Discord valida la URL al guardar; requiere el secret `DISCORD_PUBLIC_KEY`).
3. **Bot → Reset Token** si no lo tienes, e invita el bot con los permisos
   *View Channels*, *Send Messages* y *Embed Links*.

## 2. Secrets en Supabase (Project Settings → Edge Functions → Secrets)

| Secret | Para qué |
| --- | --- |
| `DISCORD_PUBLIC_KEY` | Verificar la firma de los comandos (ya configurado) |
| `DISCORD_BOT_TOKEN` | Publicar avisos en los canales elegidos con `/vants canal` |
| `DISCORD_WEBHOOK_ANUNCIOS`, `_REGISTROS`, `_RANKED`, `_STAFF`, `_LOGS` | Alternativa sin token: un webhook por canal |
| `VANTS_TZ` (opcional) | Zona horaria de las fechas de `/vants`, por defecto `Europe/Madrid` |

## 3. Registrar los comandos

```bash
DISCORD_TOKEN=... DISCORD_APP_ID=... DISCORD_GUILD_ID=... python bot/register_commands.py
```

## 4. Elegir canales (desde Discord, como staff)

```
/vants canal categoria:anuncios  canal:#anuncios
/vants canal categoria:registros canal:#registros
/vants canal categoria:ranked    canal:#ranked
/vants canal categoria:staff     canal:#staff
/vants canal categoria:logs      canal:#logs      (opcional)
/vants estado
```

Solo pueden usar `/vants` los usuarios en la tabla `bot_admins`.

## Qué se publica y dónde

| Canal | Eventos |
| --- | --- |
| anuncios | torneo publicado o cambia de estado, evento publicado, temporada iniciada o cerrada |
| registros | nuevo jugador, inscripción a torneo, confirmación de asistencia a evento |
| ranked | partida ranked finalizada, resultado de partida de torneo |
| staff | plan activado (Stripe), ticket de soporte, postulaciones |
| logs | inicios y cierres de sesión, checkout iniciado (solo si configuras el canal) |

Los avisos salen de triggers en la base de datos, así que se publican igual si el
cambio llega desde la web, desde el bot o desde el panel de Supabase. Los fallos se
reintentan cada 5 minutos (`vants-discord-retry`, hasta 5 intentos).

## Comandos

`/ayuda`, `/web`, `/vincular`, `/perfil`, `/ranking`, `/torneos`, `/torneo inscribir`,
`/eventos`, `/calendario`, `/planes` y, para staff, `/vants canal`, `/vants estado`,
`/vants torneo-crear`, `/vants torneo-estado`, `/vants evento-crear`, `/vants temporada-iniciar`.

> `bot/main.py` es el bot anterior con gateway (`/perfil`, `/vincular riot`). Si
> usas el Interactions Endpoint, ese proceso deja de recibir comandos; puedes apagarlo.
