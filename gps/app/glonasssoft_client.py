"""
GlonassSoft API Client
=======================
Client untuk mengakses API GlonassSoft dan mencatat perjalanan kendaraan.

Dokumentasi API: https://wiki.glonasssoft.ru/bin/view/API/
Rate limit: max 2 request/detik, max 50 sesi aktif per IP

Penggunaan:
    python glonasssoft_client.py

Atau import sebagai modul:
    from glonasssoft_client import GlonassSoftClient
"""

import requests
import json
import csv
import time
import logging
import os
from datetime import datetime, timedelta
from dataclasses import dataclass, field, asdict
from typing import Optional
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

def get_address(lat, lng):
    """Cari nama tempat berdasarkan koordinat (Reverse Geocoding)"""
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}&zoom=18&addressdetails=1"
        headers = {'User-Agent': 'GlonassSoftDashboard/1.0'}
        # Delay kecil untuk Nominatim
        time.sleep(1) 
        resp = requests.get(url, headers=headers, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            # Ambil bagian alamat yang ringkas
            addr = data.get("address", {})
            road = addr.get("road") or addr.get("suburb") or addr.get("city_district")
            city = addr.get("city") or addr.get("town") or addr.get("municipality")
            if road and city: return f"{road}, {city}"
            return data.get("display_name", f"{lat}, {lng}").split(",")[0:3]
            return ", ".join(data.get("display_name", "").split(",")[:3])
    except:
        pass
    return f"{lat}, {lng}"

# ─── Konfigurasi ──────────────────────────────────────────────────────────────

BASE_URL = "https://hosting.glonasssoft.ru"  # Ganti sesuai server kamu
USERNAME = "GLONASS_USERNAME_REMOVED"                   # Username GlonassSoft
PASSWORD = "GLONASS_PASSWORD_REMOVED"                   # Password GlonassSoft
LOG_DIR  = Path("./trip_logs")               # Folder penyimpanan log perjalanan

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
log = logging.getLogger("GlonassSoft")

# ─── Data Models ──────────────────────────────────────────────────────────────

@dataclass
class NavPoint:
    """Titik navigasi (koordinat GPS dari tracker)"""
    timestamp: str
    latitude: float
    longitude: float
    speed: float          # km/h
    course: int           # derajat arah
    address: str = ""

@dataclass
class Trip:
    """Satu perjalanan kendaraan: dari titik A ke titik B"""
    vehicle_id: str
    vehicle_name: str
    date: str
    start_time: str
    end_time: str
    start_address: str
    end_address: str
    start_lat: float
    start_lng: float
    end_lat: float
    end_lng: float
    distance_km: float
    duration_minutes: int
    max_speed: float
    avg_speed: float
    nav_points: list = field(default_factory=list)

    def summary(self) -> str:
        return (
            f"[{self.date}] {self.vehicle_name}\n"
            f"  DARI : {self.start_address or f'{self.start_lat},{self.start_lng}'}\n"
            f"  KE   : {self.end_address or f'{self.end_lat},{self.end_lng}'}\n"
            f"  Jam  : {self.start_time} → {self.end_time} ({self.duration_minutes} menit)\n"
            f"  Jarak: {self.distance_km:.1f} km | Maks: {self.max_speed:.0f} km/h | Rata: {self.avg_speed:.0f} km/h"
        )


# ─── API Client ───────────────────────────────────────────────────────────────

class GlonassSoftClient:
    """
    Client untuk GlonassSoft REST API v3.
    
    Flow:
        1. login()          → dapatkan token X-Auth
        2. get_vehicles()   → daftar semua kendaraan terdaftar
        3. get_trips()      → riwayat perjalanan per kendaraan per periode
        4. save_trips_csv() → simpan ke file CSV
        5. logout()         → akhiri sesi
    """

    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url.rstrip("/")
        self.token: Optional[str] = None
        self.session = requests.Session()
        self._last_request_time = 0.0
        self.api_pref = "/api/v3" # Default, akan terupdate otomatis

    def _throttle(self):
        """Pastikan max 2 request/detik sesuai rate limit GlonassSoft"""
        elapsed = time.time() - self._last_request_time
        if elapsed < 0.5:
            time.sleep(0.5 - elapsed)
        self._last_request_time = time.time()

    def _headers(self) -> dict:
        h = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        if self.token:
            h["X-Auth"] = self.token
            h["X-Session"] = self.token
            h["AuthId"] = self.token
            h["Authorization"] = f"Bearer {self.token}"
        return h

    def _get(self, path: str, params: dict = None) -> dict:
        self._throttle()
        url = f"{self.base_url}{path}"
        if not params: params = {}
        if self.token:
            params["AuthId"] = self.token # Fallback query param
            
        resp = self.session.get(url, headers=self._headers(), params=params, timeout=30)
        resp.raise_for_status()
        if not resp.text or resp.status_code == 204:
            return {}
        try:
            return resp.json()
        except Exception:
            return {}

    def _post(self, path: str, body: dict) -> dict:
        self._throttle()
        url = f"{self.base_url}{path}"
        try:
            resp = self.session.post(url, headers=self._headers(), json=body, timeout=30)
            resp.raise_for_status()
            if not resp.text or resp.status_code == 204:
                return {}
            return resp.json()
        except Exception as e:
            log.error(f"POST {path} Error: {e}")
            return {}

    # ── Auth ──────────────────────────────────────────────────────────────────

    def login(self, username: str = USERNAME, password: str = PASSWORD) -> bool:
        """
        Login dan simpan token X-Auth.
        Token berlaku selama durasi sesi yang dikonfigurasi di akun.
        """
        try:
            data = self._post("/api/v3/auth/login", {
                "login": username,
                "password": password
            })
            log.info(f"Response Login: {data}")
            self.token = data.get("AuthId") or data.get("SessionId") or data.get("token")
            self.user_id = data.get("UserId")
            if self.token:
                log.info(f"Login berhasil. User: {data.get('User', username)}")
                return True
            log.error("Login gagal: token tidak ditemukan di respons")
            return False
        except requests.HTTPError as e:
            log.error(f"Login error: {e}")
            return False

    def logout(self):
        """Akhiri sesi API"""
        if self.token:
            try:
                self._post("/api/v3/auth/logout", {})
                log.info("Logout berhasil")
            except Exception:
                pass
            self.token = None

    def check_session(self) -> bool:
        """Cek apakah token masih aktif"""
        try:
            self._get(f"{self.api_pref}/auth/check")
            return True
        except requests.HTTPError as e:
            if e.response.status_code == 401:
                return False
            raise

    # ── Vehicles ──────────────────────────────────────────────────────────────

    def get_vehicles(self) -> list[dict]:
        """
        Ambil semua kendaraan/objek monitoring dalam akun.
        Return: list of dict dengan field: id, Name, StateNumber, dll.
        """
        try:
            # Daftar endpoint penemuan kendaraan yang lebih luas
            endpoints = [
                "/api/v3/monitoring/tree",
                "/api/v3/vehicles",
                "/api/vehicles", # Sukses sebelumnya
                "/api/v3/settings/terminalunits",
                "/api/v3/monitoring/units",
                "/api/v2/vehicles"
            ]
            for endpoint in endpoints:
                try:
                    url = f"{self.base_url}{endpoint}"
                    params = {"AuthId": self.token}
                    resp = self.session.get(url, headers=self._headers(), params=params, timeout=10)
                    
                    if resp.status_code == 200:
                        data = resp.json()
                        if not data: continue
                        
                        vehicles = []
                        if isinstance(data, list):
                            vehicles = data
                        elif isinstance(data, dict):
                            # Jika dari 'tree', kendaraan biasanya ada di dalam Group
                            if "Groups" in data or "Items" in data or "Vehicles" in data:
                                def flatten_tree(item):
                                    res = []
                                    if isinstance(item, list):
                                        for i in item: res.extend(flatten_tree(i))
                                    elif isinstance(item, dict):
                                        if item.get("id") or item.get("Id"): res.append(item)
                                        for key in ["Groups", "Items", "Vehicles", "Units"]:
                                            if key in item: res.extend(flatten_tree(item[key]))
                                    return res
                                vehicles = flatten_tree(data)
                            else:
                                for key in ["Vehicles", "Units", "Items", "items", "Data", "data"]:
                                    if key in data and isinstance(data[key], list):
                                        vehicles = data[key]
                                        break
                        
                        if vehicles and len(vehicles) > 0:
                            log.info(f"YAY! Ditemukan {len(vehicles)} kendaraan di {endpoint}")
                            if endpoint.startswith("/api/v3"): self.api_pref = "/api/v3"
                            else: self.api_pref = "/api"
                            return vehicles
                except Exception:
                    pass
            
            log.warning("Pencarian kendaraan selesai tanpa hasil. Mohon cek apakah ada kendaraan terdaftar di akun ini.")
            return []
        except Exception as e:
            log.error(f"Gagal ambil daftar kendaraan: {e}")
            return []

    def get_vehicle_last_position(self, vehicle_id: str) -> Optional[dict]:
        """Posisi terakhir kendaraan (real-time)"""
        try:
            return self._get(f"{self.api_pref}/vehicles/{vehicle_id}/laststates")
        except Exception as e:
            log.error(f"Gagal ambil posisi kendaraan {vehicle_id}: {e}")
            return None

    # ── Navigation History ────────────────────────────────────────────────────

    def get_nav_points(
        self,
        vehicle_id: str,
        date_from: datetime,
        date_to: datetime,
        v_obj: dict = None
    ) -> list[NavPoint]:
        """
        Ambil titik navigasi GPS menggunakan format proprietary GlonassSoft history/points.
        Format respons: BaseTime&Lat,Lng,OffsetMS,Speed:Lat,Lng,OffsetMS,Speed...
        """
        try:
            # ID Angka adalah wajib untuk endpoint ini
            v_num_id = v_obj.get("vehicleId") if isinstance(v_obj, dict) else vehicle_id
            
            # Format waktu ISO Z (UTC)
            dt_start = date_from.strftime("%Y-%m-%dT%H:%M:%S.000Z")
            dt_end   = date_to.strftime("%Y-%m-%dT%H:%M:%S.999Z")

            params = {
                "vehicleId": v_num_id,
                "start": dt_start,
                "end": dt_end
            }

            url = f"{self.base_url}/api/history/points"
            resp = self.session.get(url, headers=self._headers(), params=params, timeout=30)
            
            if resp.status_code != 200 or not resp.text or "&" not in resp.text:
                log.warning(f"  No history points found for {vehicle_id} (Status: {resp.status_code})")
                return []

            # PARSER LOGIC untuk format proprietary
            base_part, data_part = resp.text.split('&', 1)
            
            # Bersihkan base_part (misal: "2026-04-11 00:00:00Z")
            base_part = base_part.strip().replace("Z", "")
            try:
                base_dt = datetime.strptime(base_part, "%Y-%m-%d %H:%M:%S")
            except:
                base_dt = date_from # Fallback
            
            segments = data_part.split(':')
            points = []
            
            for s in segments:
                if not s: continue
                parts = s.split(',')
                if len(parts) < 3: continue
                
                try:
                    lat = float(parts[0])
                    lng = float(parts[1])
                    offset_ms = int(parts[2])
                    speed = float(parts[3]) if len(parts) > 3 else 0
                    
                    actual_time = base_dt + timedelta(milliseconds=offset_ms)
                    
                    points.append(NavPoint(
                        timestamp = actual_time.strftime("%Y-%m-%dT%H:%M:%S"),
                        latitude  = lat,
                        longitude = lng,
                        speed     = speed,
                        course    = 0,
                        address   = ""
                    ))
                except:
                    continue
            
            log.info(f"  ✓ Berhasil memproses {len(points)} titik GPS dari format proprietary.")
            return points

        except Exception as e:
            log.error(f"Gagal parse nav points proprietary {vehicle_id}: {e}")
            return []

    # ── Trip Reports ──────────────────────────────────────────────────────────

    def get_trips(
        self,
        vehicle_id: str,
        vehicle_name: str,
        date_from: datetime,
        date_to:   datetime,
        v_obj: dict = None
    ) -> list[Trip]:
        """
        Ambil riwayat perjalanan dari laporan GlonassSoft.
        Kalau endpoint laporan tidak tersedia, hitung dari nav points.
        """
        # Coba endpoint laporan resmi dulu
        trips = self._get_trips_from_report(vehicle_id, vehicle_name, date_from, date_to, v_obj=v_obj)
        if trips:
            return trips

        # Fallback: hitung dari raw nav points
        log.info(f"  Menghitung perjalanan dari nav points untuk {vehicle_name}...")
        nav_points = self.get_nav_points(vehicle_id, date_from, date_to, v_obj=v_obj)
        return self._parse_trips_from_nav_points(vehicle_id, vehicle_name, nav_points)

    def _get_trips_from_report(
        self,
        vehicle_id: str,
        vehicle_name: str,
        date_from: datetime,
        date_to:   datetime,
        v_obj: dict = None
    ) -> list[Trip]:
        """Ambil perjalanan dari endpoint report GlonassSoft"""
        try:
            # Menggunakan ISO Z format yang sering dipakai di GlonassSoft v3 terbaru
            dt_from_z = date_from.strftime("%Y-%m-%dT%H:%M:%S.000Z")
            dt_to_z = date_to.strftime("%Y-%m-%dT%H:%M:%S.999Z")

            params = {
                "from": date_from.strftime("%Y-%m-%dT%H:%M:%S"),
                "to":   date_to.strftime("%Y-%m-%dT%H:%M:%S"),
                "begin": dt_from_z,
                "end": dt_to_z
            }
            v_num_id = v_obj.get("vehicleId") if isinstance(v_obj, dict) else None
            
            data = None
            for p_id in [vehicle_id, v_num_id]:
                if not p_id: continue
                # Coba prefik terdeteksi dan v3 default
                for path in [
                    f"/api/v3/units/{p_id}/trips",
                    f"{self.api_pref}/vehicles/{p_id}/trips", 
                    f"/api/v3/vehicles/{p_id}/trips"
                ]:
                    try:
                        data = self._get(path, params=params)
                        if data: break
                    except: continue
                if data: break
            
            if not data: return []
            raw_trips = data if isinstance(data, list) else data.get("Trips", [])

            trips = []
            for t in raw_trips:
                trip = Trip(
                    vehicle_id      = vehicle_id,
                    vehicle_name    = vehicle_name,
                    date            = (t.get("StartTime") or "")[:10],
                    start_time      = (t.get("StartTime") or "")[11:16],
                    end_time        = (t.get("EndTime")   or "")[11:16],
                    start_address   = t.get("StartAddress", ""),
                    end_address     = t.get("EndAddress",   ""),
                    start_lat       = float(t.get("StartLat", 0)),
                    start_lng       = float(t.get("StartLon", 0)),
                    end_lat         = float(t.get("EndLat", 0)),
                    end_lng         = float(t.get("EndLon", 0)),
                    distance_km     = float(t.get("Mileage", 0)),
                    duration_minutes= int(t.get("Duration", 0)),
                    max_speed       = float(t.get("MaxSpeed", 0)),
                    avg_speed       = float(t.get("AvgSpeed", 0)),
                )
                trips.append(trip)
            return trips
        except Exception:
            return []

    def _parse_trips_from_nav_points(
        self,
        vehicle_id: str,
        vehicle_name: str,
        nav_points: list[NavPoint],
        stop_threshold_kmh: float = 2.0,
        stop_duration_min:  int   = 5
    ) -> list[Trip]:
        """
        Pisahkan nav points menjadi perjalanan berdasarkan deteksi berhenti.
        Kendaraan dianggap berhenti kalau speed < threshold selama > stop_duration_min menit.
        """
        if not nav_points:
            return []

        trips = []
        current_trip_points: list[NavPoint] = []
        stopped_since: Optional[datetime] = None

        for pt in nav_points:
            try:
                ts = datetime.fromisoformat(pt.timestamp.replace("Z", "+00:00"))
            except Exception:
                continue

            is_moving = pt.speed > stop_threshold_kmh

            if is_moving:
                stopped_since = None
                current_trip_points.append(pt)
            else:
                if stopped_since is None:
                    stopped_since = ts
                    current_trip_points.append(pt)
                else:
                    stop_dur = (ts - stopped_since).total_seconds() / 60
                    if stop_dur >= stop_duration_min and len(current_trip_points) >= 2:
                        trip = self._build_trip(vehicle_id, vehicle_name, current_trip_points)
                        if trip:
                            trips.append(trip)
                        current_trip_points = []
                        stopped_since = None
                    else:
                        current_trip_points.append(pt)

        # Tangkap perjalanan terakhir
        if len(current_trip_points) >= 2:
            trip = self._build_trip(vehicle_id, vehicle_name, current_trip_points)
            if trip:
                trips.append(trip)

        log.info(f"  → {len(trips)} perjalanan terdeteksi untuk {vehicle_name}")
        return trips

    def _build_trip(self, vehicle_id: str, vehicle_name: str, points: list[NavPoint]) -> Optional[Trip]:
        if len(points) < 2:
            return None
        start = points[0]
        end   = points[-1]
        speeds = [p.speed for p in points if p.speed > 0]

        try:
            t_start = datetime.fromisoformat(start.timestamp.replace("Z", "+00:00"))
            t_end   = datetime.fromisoformat(end.timestamp.replace("Z", "+00:00"))
            duration = int((t_end - t_start).total_seconds() / 60)
        except Exception:
            duration = 0

        # Hitung jarak Haversine
        distance = sum(
            _haversine(points[i].latitude, points[i].longitude,
                       points[i+1].latitude, points[i+1].longitude)
            for i in range(len(points) - 1)
        )

        # Geocoding untuk nama tempat
        log.info(f"    - Mencari alamat perjalanan {vehicle_name}...")
        addr_start = get_address(start.latitude, start.longitude)
        addr_end   = get_address(end.latitude, end.longitude)

        avg_spd = round(distance / (duration/60), 1) if duration > 0 else 0

        return Trip(
            vehicle_id       = vehicle_id,
            vehicle_name     = vehicle_name,
            date             = start.timestamp[:10],
            start_time       = start.timestamp[11:16],
            end_time         = end.timestamp[11:16],
            start_address    = addr_start,
            end_address      = addr_end,
            start_lat        = start.latitude,
            start_lng        = start.longitude,
            end_lat          = end.latitude,
            end_lng          = end.longitude,
            distance_km      = round(distance, 2),
            duration_minutes = duration,
            max_speed        = max(speeds, default=0),
            avg_speed        = avg_spd,
            nav_points       = points,
        )

    # ── Export ────────────────────────────────────────────────────────────────

    def save_trips_csv(self, trips: list[Trip], filename: str = "") -> Path:
        """Simpan semua perjalanan ke file CSV"""
        LOG_DIR.mkdir(exist_ok=True)
        if not filename:
            filename = f"trips_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        path = LOG_DIR / filename

        fieldnames = [
            "tanggal", "kendaraan", "dari_jam", "ke_jam", "durasi_menit",
            "titik_awal", "lat_awal", "lng_awal",
            "titik_akhir", "lat_akhir", "lng_akhir",
            "jarak_km", "kec_max_kmh", "kec_rata_kmh"
        ]
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for t in trips:
                writer.writerow({
                    "tanggal":       t.date,
                    "kendaraan":     t.vehicle_name,
                    "dari_jam":      t.start_time,
                    "ke_jam":        t.end_time,
                    "durasi_menit":  t.duration_minutes,
                    "titik_awal":    t.start_address or f"{t.start_lat},{t.start_lng}",
                    "lat_awal":      t.start_lat,
                    "lng_awal":      t.start_lng,
                    "titik_akhir":   t.end_address or f"{t.end_lat},{t.end_lng}",
                    "lat_akhir":     t.end_lat,
                    "lng_akhir":     t.end_lng,
                    "jarak_km":      t.distance_km,
                    "kec_max_kmh":   t.max_speed,
                    "kec_rata_kmh":  t.avg_speed,
                })
        log.info(f"CSV disimpan: {path} ({len(trips)} baris)")
        return path

    def save_trips_json(self, trips: list[Trip], filename: str = "") -> Path:
        """Simpan semua perjalanan ke file JSON"""
        LOG_DIR.mkdir(exist_ok=True)
        if not filename:
            filename = f"trips_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        path = LOG_DIR / filename

        data = []
        for t in trips:
            d = asdict(t)
            # Hapus nav_points dari JSON ringkasan (opsional)
            d.pop("nav_points", None)
            data.append(d)

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        log.info(f"JSON disimpan: {path}")
        return path


# ─── Helpers ──────────────────────────────────────────────────────────────────

import math

def _haversine(lat1, lon1, lat2, lon2) -> float:
    """Hitung jarak antara dua koordinat GPS dalam km"""
    R = 6371.0
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    Δφ = math.radians(lat2 - lat1)
    Δλ = math.radians(lon2 - lon1)
    a = math.sin(Δφ/2)**2 + math.cos(φ1) * math.cos(φ2) * math.sin(Δλ/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    client = GlonassSoftClient(BASE_URL)

    # 1. Login
    if not client.login(USERNAME, PASSWORD):
        print("Login gagal. Cek username/password dan BASE_URL.")
        return

    try:
        # 2. Ambil daftar kendaraan
        vehicles = client.get_vehicles()
        if not vehicles:
            print("Tidak ada kendaraan ditemukan di akun ini.")
            return

        print(f"\n{'─'*55}")
        print(f"  DAFTAR KENDARAAN ({len(vehicles)} unit)")
        print(f"{'─'*55}")
        for v in vehicles:
            vid  = v.get("Id") or v.get("id", "?")
            name = v.get("Name") or v.get("name", "Unknown")
            plate= v.get("StateNumber") or v.get("GarageNumber", "")
            print(f"  [{vid}] {name}  {plate}")

        # 3. Tentukan periode (default: 7 hari terakhir)
        date_to   = datetime.now()
        date_from = date_to - timedelta(days=7)
        print(f"\n  Periode: {date_from.strftime('%d %b %Y')} → {date_to.strftime('%d %b %Y')}")
        print(f"{'─'*55}\n")

        # 4. Ambil perjalanan semua kendaraan
        all_trips: list[Trip] = []
        for v in vehicles:
            vid  = v.get("Id") or v.get("id")
            name = v.get("Name") or v.get("name", "Unknown")
            print(f"  ⟳ Mengambil data: {name}...")
            trips = client.get_trips(vid, name, date_from, date_to)
            all_trips.extend(trips)

        # 5. Tampilkan ringkasan
        print(f"\n{'═'*55}")
        print(f"  RINGKASAN PERJALANAN: {len(all_trips)} trip")
        print(f"{'═'*55}")
        for trip in all_trips:
            print(trip.summary())
            print()

        # Statistik total
        total_km = sum(t.distance_km for t in all_trips)
        total_dur = sum(t.duration_minutes for t in all_trips)
        print(f"{'─'*55}")
        print(f"  TOTAL: {total_km:.1f} km | {total_dur} menit ({total_dur//60}j {total_dur%60}m)")
        print(f"{'─'*55}\n")

        # 6. Simpan ke CSV dan JSON
        if all_trips:
            csv_path  = client.save_trips_csv(all_trips)
            json_path = client.save_trips_json(all_trips)
            print("Tersimpan:")
            print(f"     CSV  → {csv_path}")
            print(f"     JSON → {json_path}")

    finally:
        client.logout()


# ─── Flask Server ──────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app) # Izinkan dashboard akses API ini

@app.route("/")
def index():
    """Tampilkan dashboard utama"""
    return send_from_directory(".", "glonasssoft_dashboard.html")

@app.route("/api/trips")
def api_trips():
    print("\n>>> MENERIMA PERMINTAAN DATA DARI DASHBOARD...")
    """Endpoint untuk diambil oleh dashboard"""
    server = request.args.get("server", BASE_URL)
    user   = request.args.get("user", USERNAME)
    pw     = request.args.get("pass", PASSWORD)
    days   = int(request.args.get("days", 7))

    client = GlonassSoftClient(server)
    if not client.login(user, pw):
        return jsonify({"error": "Login gagal ke GlonassSoft"}), 401
    
    try:
        vehicles = client.get_vehicles()
        if not vehicles:
            log.warning("Tidak ada kendaraan ditemukan.")
            return jsonify({"trips": [], "vehicles_count": 0})
            
        date_to   = datetime.now()
        date_from = date_to - timedelta(days=days)
        
        all_trips = []
        for v in vehicles:
            try:
                # Prioritas ID: id (uuid) -> vehicleId (angka)
                vid  = v.get("id") or v.get("Id") or v.get("vehicleId") or v.get("Guid")
                if not vid: continue
                
                # Gunakan Plate Number ('number') sebagai nama utama jika ada
                name = (v.get("number") or v.get("Name") or v.get("name") or 
                        v.get("StateNumber") or str(vid))
                
                log.info(f"==> Tarik data: {name}...")
                trips = client.get_trips(vid, name, date_from, date_to, v_obj=v)
                for t in trips:
                    d = asdict(t)
                    d.pop("nav_points", None)
                    all_trips.append(d)
            except Exception as e:
                log.error(f"Error pada kendaraan {v}: {e}")
                continue
        
        return jsonify({
            "trips": all_trips,
            "vehicles_count": len(vehicles),
            "status": "success"
        })
    except Exception as e:
        log.error(f"CRITICAL ERROR: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        client.logout()

if __name__ == "__main__":
    # Jika dijalankan langsung, nyalakan server Flask pada port 5050
    print("\n" + "="*50)
    print(" GLONASSSOFT BACKEND SERVER AKTIF")
    print(" Alamat: http://localhost:5050")
    print("="*50 + "\n")
    app.run(host="0.0.0.0", port=5050, debug=False)
