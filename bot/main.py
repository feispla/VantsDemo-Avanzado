import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

import discord
from discord import app_commands

from commands.perfil import perfil_handler
from commands.vincular import vincular_riot_handler
from utils.health import start_health_server
from utils.supabase_client import supabase


def required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Falta la variable de entorno {name}")
    return value


TOKEN = required_env("DISCORD_TOKEN")
GUILD_ID = int(required_env("DISCORD_GUILD_ID"))
GUILD = discord.Object(id=GUILD_ID)

intents = discord.Intents.default()
client = discord.Client(intents=intents)
tree = app_commands.CommandTree(client)


# ─────────────────────────────────────────────────────────────────────────────
# GRUPO: vincular
# ─────────────────────────────────────────────────────────────────────────────
vincular_group = app_commands.Group(
    name="vincular",
    description="Vincula una cuenta externa a tu perfil VANTS",
)


@vincular_group.command(name="riot", description="Vincula tu cuenta de Riot (Valorant)")
@app_commands.describe(handle="Tu Riot ID completo, por ejemplo: Nombre#TAG")
async def vincular_riot(interaction: discord.Interaction, handle: str) -> None:
    await vincular_riot_handler(interaction, handle)


tree.add_command(vincular_group, guild=GUILD)


# ─────────────────────────────────────────────────────────────────────────────
# COMANDO: perfil
# ─────────────────────────────────────────────────────────────────────────────
@tree.command(guild=GUILD, name="perfil", description="Muestra el perfil VANTS de un jugador")
@app_commands.describe(usuario="Jugador a consultar (opcional, por defecto tú)")
async def perfil_command(interaction: discord.Interaction, usuario: discord.User | None = None) -> None:
    await perfil_handler(interaction, usuario)


# ─────────────────────────────────────────────────────────────────────────────
# COMANDO: setup (ACTUALIZADO - Usa canales existentes con IDs fijas)
# ─────────────────────────────────────────────────────────────────────────────
@tree.command(guild=GUILD, name="setup", description="Configura automáticamente los canales de VANTCALL")
@app_commands.checks.has_permissions(administrator=True)
async def setup_command(interaction: discord.Interaction) -> None:
    await interaction.response.defer(ephemeral=True)
    
    guild = interaction.guild
    guild_id = str(guild.id)
    
    try:
        # IDs de canales fijos (ya existentes en tu servidor)
        canales_ids = {
            "welcome": "1546654795186577488",
            "anuncios": "1553634435671396432",
            "tryouts": "1553938201754730506",
            "resultados": "1553938926320877669",
            "estadisticas": "1553863844915585146",
            "sup": "1553659242458652733",
            "torneos": "1553659315565367307",
        }
        
        # Obtener objetos de canal
        canales = {}
        for nombre, canal_id in canales_ids.items():
            canal = guild.get_channel(int(canal_id))
            if canal:
                canales[nombre] = canal
        
        # Guardar en Supabase
        supabase.table("guild_configs").upsert({
            "guild_id": guild_id,
            "guild_name": guild.name,
            "anuncios_channel_id": canales_ids["anuncios"],
            "tryouts_channel_id": canales_ids["tryouts"],
            "resultados_channel_id": canales_ids["resultados"],
            "comandos_channel_id": canales_ids["torneos"],
        }).execute()
        
        # Mensaje de éxito
        embed = discord.Embed(
            title="✅ Servidor configurado",
            description=f"**{guild.name}** está listo para VANTCALL",
            color=0x00FF00
        )
        
        embed.add_field(
            name="📢 Canales configurados",
            value=(
                f"• {canales['anuncios'].mention} - Anuncios\n"
                f"• {canales['tryouts'].mention} - Tryouts\n"
                f"• {canales['resultados'].mention} - Resultados\n"
                f"• {canales['torneos'].mention} - Torneos\n"
                f"• {canales['estadisticas'].mention} - Estadísticas\n"
                f"• {canales['sup'].mention} - Sup\n"
            ),
            inline=False
        )
        
        embed.add_field(
            name="🚀 Primeros pasos",
            value=(
                "Usa `/perfil` para ver tu perfil\n"
                "Usa `/vincular riot <ID>` para conectar tu cuenta\n"
                "Los anuncios de torneos llegarán a " + canales["anuncios"].mention
            ),
            inline=False
        )
        
        # Enviar mensaje en el canal de anuncios con @everyone
        await canales["anuncios"].send(
            content="@everyone 🏆 **VANTCALL ya está disponible en este servidor**",
            embed=embed
        )
        
        # Confirmación para el admin
        await interaction.followup.send(
            "✅ Canales configurados y anuncio enviado a " + canales["anuncios"].mention,
            ephemeral=True
        )
        
    except Exception as e:
        await interaction.followup.send(f"❌ Error: {str(e)}", ephemeral=True)


# ─────────────────────────────────────────────────────────────────────────────
# GRUPO: valorant
# ─────────────────────────────────────────────────────────────────────────────
valorant_group = app_commands.Group(
    name="valorant",
    description="Ranking y perfiles de Valorant",
)


def _get_valorant_ranking() -> list[dict]:
    response = (
        supabase.table("valorant_leaderboard_public")
        .select("rank_position, display_name, rank, rr, wins, win_rate")
        .order("rank_position")
        .limit(10)
        .execute()
    )
    return response.data or []


def _get_valorant_profile(discord_id: str) -> dict | None:
    # Primero busca la vinculación en la tabla dedicada.
    links = (
        supabase.table("player_discord_accounts")
        .select("player_id")
        .eq("discord_id", discord_id)
        .limit(1)
        .execute()
        .data
        or []
    )

    player_id = links[0]["player_id"] if links else None

    # Compatibilidad con perfiles vinculados directamente en players.
    if not player_id:
        players = (
            supabase.table("players")
            .select("id")
            .eq("discord_user_id", discord_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        player_id = players[0]["id"] if players else None

    if not player_id:
        return None

    players = (
        supabase.table("players")
        .select("id, username, display_name, region")
        .eq("id", player_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    stats = (
        supabase.table("valorant_stats")
        .select("rank, rr, games_played, wins, losses, win_rate, peak_rank, act, region, last_updated")
        .eq("player_id", player_id)
        .limit(1)
        .execute()
        .data
        or []
    )

    if not players or not stats:
        return None

    # La función devuelve la posición del jugador en el leaderboard.
    rank_response = supabase.rpc(
        "get_player_valorant_rank",
        {"p_player_id": player_id},
    ).execute()

    rank_rows = rank_response.data or []

    return {
        "player": players[0],
        "stats": stats[0],
        "rank_position": rank_rows[0].get("rank_position") if rank_rows else None,
    }


def _safe_discord_text(value: object, limit: int = 80) -> str:
    text = str(value or "—").replace("@everyone", "@\u200beveryone").replace("@here", "@\u200bhere")
    return text[:limit]


@valorant_group.command(name="ranking", description="Muestra el top 10 de Valorant")
async def valorant_ranking(interaction: discord.Interaction) -> None:
    await interaction.response.defer()

    try:
        rows = await asyncio.to_thread(_get_valorant_ranking)
    except Exception:
        await interaction.followup.send(
            "No se pudo cargar el ranking de Valorant ahora mismo.",
            ephemeral=True,
        )
        return

    if not rows:
        await interaction.followup.send(
            "Aún no hay jugadores en el ranking de Valorant.",
            ephemeral=False,
        )
        return

    embed = discord.Embed(
        title="Ranking de Valorant · Top 10",
        color=discord.Color(0xFF4655),
    )

    lines = []
    for row in rows:
        name = _safe_discord_text(row.get("display_name"), 32)
        rank = _safe_discord_text(row.get("rank"), 24)
        rr = row.get("rr", 0)
        wins = row.get("wins", 0)
        win_rate = float(row.get("win_rate") or 0)
        position = row.get("rank_position", "?")
        lines.append(
            f"**{position}.** {name} — **{rank} {rr} RR** · "
            f"{wins} victorias · {win_rate:.1f}% WR"
        )

    embed.description = "\n".join(lines)
    await interaction.followup.send(embed=embed, ephemeral=False)


@valorant_group.command(name="perfil", description="Muestra las stats de Valorant de un jugador")
@app_commands.describe(usuario="Jugador a consultar; si se omite, muestra tu perfil")
async def valorant_perfil(
    interaction: discord.Interaction,
    usuario: discord.User | None = None,
) -> None:
    target = usuario or interaction.user

    try:
        result = await asyncio.to_thread(
            _get_valorant_profile,
            str(target.id),
        )
    except Exception:
        await interaction.response.send_message(
            "No se pudieron cargar las stats de Valorant ahora mismo.",
            ephemeral=True,
        )
        return

    if not result:
        await interaction.response.send_message(
            f"No hay perfil VANTS o stats de Valorant sincronizadas para {target.mention}.",
            ephemeral=True,
            allowed_mentions=discord.AllowedMentions.none(),
        )
        return

    player = result["player"]
    stats = result["stats"]
    name = _safe_discord_text(player.get("display_name") or player.get("username"))
    games = stats.get("games_played") or 0
    wins = stats.get("wins") or 0
    losses = stats.get("losses") or 0
    win_rate = float(stats.get("win_rate") or 0)
    position = result.get("rank_position")

    embed = discord.Embed(
        title=f"Valorant · {name}",
        color=discord.Color(0xFF4655),
    )
    embed.add_field(
        name="Rango actual",
        value=f"{_safe_discord_text(stats.get('rank'), 32)} · {stats.get('rr') or 0} RR",
        inline=True,
    )
    embed.add_field(
        name="Posición",
        value=f"#{position}" if position else "Sin clasificar",
        inline=True,
    )
    embed.add_field(
        name="Rango máximo",
        value=_safe_discord_text(stats.get("peak_rank"), 32),
        inline=True,
    )
    embed.add_field(
        name="Victorias / derrotas",
        value=f"{wins} / {losses} · {win_rate:.1f}% WR",
        inline=True,
    )
    embed.add_field(name="Partidas", value=str(games), inline=True)
    embed.add_field(
        name="Acto / región",
        value=(
            f"{_safe_discord_text(stats.get('act'), 24)} · "
            f"{_safe_discord_text(stats.get('region') or player.get('region'), 24)}"
        ),
        inline=True,
    )

    await interaction.response.send_message(embed=embed, ephemeral=True)


tree.add_command(valorant_group, guild=GUILD)


# ─────────────────────────────────────────────────────────────────────────────
# EVENTOS
# ─────────────────────────────────────────────────────────────────────────────
@client.event
async def on_ready() -> None:
    await start_health_server()
    await tree.sync(guild=GUILD)
    print(f"✅ vantcall conectado como {client.user}")
    print(f"📋 Comandos registrados en guild {GUILD_ID}")


client.run(TOKEN)
