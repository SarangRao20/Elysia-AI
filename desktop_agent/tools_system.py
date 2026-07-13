"""
System information: CPU, RAM, disk usage, GPU (best-effort), temperature.

All read-only. psutil powers the core metrics; GPU stats come from
nvidia-ml-py3 (pynvml) when an NVIDIA GPU is present, and degrade gracefully
otherwise. Temperature is best-effort via psutil.sensors_temperatures (Linux)
or WMI on Windows when available.
"""

from __future__ import annotations

import platform
from typing import Any, Dict

from .registry import register


def _bytes_human(n: float) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB", "PB"):
        if n < 1024.0:
            return f"{n:.1f}{unit}"
        n /= 1024.0
    return f"{n:.1f}EB"


@register("systemInfo")
def system_info(args: Dict[str, Any]) -> Dict[str, Any]:
    import psutil

    cpu_percent = psutil.cpu_percent(interval=0.3)
    cpu_count_logical = psutil.cpu_count(logical=True)
    cpu_count_physical = psutil.cpu_count(logical=False) or cpu_count_logical

    vm = psutil.virtual_memory()
    ram_total = vm.total
    ram_used = vm.used
    ram_percent = vm.percent

    # Disk usage on the system drive (and project drive if different).
    disks: Dict[str, Dict[str, Any]] = {}
    seen = set()
    try:
        for part in psutil.disk_partitions(all=False):
            mp = part.mountpoint
            if mp in seen:
                continue
            seen.add(mp)
            try:
                du = psutil.disk_usage(mp)
                disks[mp] = {
                    "total": _bytes_human(du.total),
                    "used": _bytes_human(du.used),
                    "free": _bytes_human(du.free),
                    "percent": du.percent,
                }
            except Exception:
                continue
    except Exception:
        pass

    boot = psutil.boot_time()
    import datetime as _dt

    uptime = _dt.datetime.now() - _dt.datetime.fromtimestamp(boot)

    return {
        "result": (
            f"CPU {cpu_percent}% ({cpu_count_physical} cores / {cpu_count_logical} threads). "
            f"RAM {ram_percent}% ({_bytes_human(ram_used)}/{_bytes_human(ram_total)}). "
            f"{len(disks)} disk(s) monitored. Uptime {uptime}."
        ),
        "cpu": {"percent": cpu_percent, "physical_cores": cpu_count_physical, "logical_cores": cpu_count_logical},
        "ram": {"percent": ram_percent, "used": _bytes_human(ram_used), "total": _bytes_human(ram_total)},
        "disks": disks,
        "uptime_seconds": int(uptime.total_seconds()),
        "os": platform.platform(),
    }


def _gpu_stats() -> list:
    try:
        import pynvml  # type: ignore
        from pynvml import (  # type: ignore
            NVML_TEMPERATURE_GPU,
            NVML_CLOCK_GRAPHICS,
            NVML_CLOCK_MEM,
            nvmlInit,
            nvmlDeviceGetCount,
            nvmlDeviceGetHandleByIndex,
            nvmlDeviceGetName,
            nvmlDeviceGetUtilizationRates,
            nvmlDeviceGetMemoryInfo,
            nvmlDeviceGetTemperature,
            nvmlDeviceGetClockInfo,
        )
    except Exception:
        return []

    gpus = []
    try:
        nvmlInit()
        count = nvmlDeviceGetCount()
        for i in range(count):
            h = nvmlDeviceGetHandleByIndex(i)
            util = nvmlDeviceGetUtilizationRates(h)
            mem = nvmlDeviceGetMemoryInfo(h)
            gpus.append(
                {
                    "index": i,
                    "name": nvmlDeviceGetName(h).decode() if isinstance(nvmlDeviceGetName(h), bytes) else str(nvmlDeviceGetName(h)),
                    "gpu_utilization_percent": util.gpu,
                    "memory_utilization_percent": util.memory,
                    "memory_total": _bytes_human(mem.total),
                    "memory_used": _bytes_human(mem.used),
                    "memory_free": _bytes_human(mem.free),
                    "temperature_c": nvmlDeviceGetTemperature(h, NVML_TEMPERATURE_GPU),
                }
            )
    except Exception:
        return []
    return gpus


@register("gpuInfo")
def gpu_info(args: Dict[str, Any]) -> Dict[str, Any]:
    gpus = _gpu_stats()
    if not gpus:
        return {
            "result": (
                "No NVIDIA GPU stats available via pynvml (no NVIDIA GPU, "
                "driver missing, or nvidia-ml-py3 not installed)."
            ),
            "gpus": [],
        }
    summary = "; ".join(
        f"{g['name']}: {g['gpu_utilization_percent']}% GPU, "
        f"{g['memory_used']}/{g['memory_total']} VRAM, {g['temperature_c']}°C"
        for g in gpus
    )
    return {"result": summary, "gpus": gpus}


@register("temperatureInfo")
def temperature_info(args: Dict[str, Any]) -> Dict[str, Any]:
    # Prefer GPU temp if available (NVIDIA), then psutil sensors.
    gpus = _gpu_stats()
    temps: Dict[str, Any] = {}
    for g in gpus:
        temps[f"gpu{g['index']}"] = g["temperature_c"]

    try:
        import psutil

        sensors = psutil.sensors_temperatures() if hasattr(psutil, "sensors_temperatures") else {}
        for name, entries in (sensors or {}).items():
            for entry in entries[:1]:
                temps[name] = entry.current
    except Exception:
        pass

    # Windows CPU temps generally require admin + OpenHardwareMonitor/LibreHardwareMonitor.
    if not temps:
        return {
            "result": (
                "Temperature reading unavailable. On Windows, CPU temps need "
                "LibreHardwareMonitor or admin access; GPU temps need an NVIDIA GPU."
            ),
            "temperatures": {},
        }
    summary = ", ".join(f"{k}={v}°C" for k, v in temps.items())
    return {"result": f"Temperatures: {summary}.", "temperatures": temps}


__all__ = ["system_info", "gpu_info", "temperature_info"]
