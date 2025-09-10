(() => {
  "use strict";

  const map = new maplibregl.Map({
    container: "map",
    style: "https://tile.openstreetmap.jp/styles/osm-bright-ja/style.json",
    center: [139.72195, 35.62513],
    zoom: 14,
  });

  map.addControl(new maplibregl.NavigationControl());

  /**
   * 軌跡
   * @type {Array.<[number, number]>}
   */
  const trajectory = [];

  function updateTrajectory() {
    const trajectorySource = map.getSource("trajectory");
    if (!trajectorySource) return;
    const features = [];
    if (trajectory.length > 0) {
      features.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: trajectory }
      });
    }
    trajectorySource.setData({ type: "FeatureCollection", features});
  }

  // GeoJSON ソース追加
  map.on("load", () => {
    map.addSource("trajectory", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "trajectory-line",
      type: "line",
      source: "trajectory",
      paint: { "line-color": "green", "line-width": 3 }
    });
    // URLから復元
    restoreFromUrl();
    // 現在位置トラッキング開始
    geolocate.trigger();
  });

  /**
   * お気に入り
   * @type {Array.<maplibregl.Marker>}
   */
  const favorites = [];

  /**
   * お気に入りを追加
   * @param {[number, number]} lngLat [lng, lat]
   */
  function addFavorite(lngLat) {
    const marker = new maplibregl.Marker({ color: "red", draggable: true })
      .setLngLat(lngLat)
      .addTo(map);
    favorites.push(marker);
  }

  /**
   * 全削除
   */
  function clearAll() {
    favorites.forEach(m => m.remove());
    favorites.splice(0);
    trajectory.splice(0);
    updateTrajectory();
  }

  /**
   * お気に入りをURLクエリに保存
   */
  function saveUrl() {
    if (favorites.length === 0) return;
    const latLng = favorites.map(m => m.getLngLat()).map(p => [p.lat, p.lng]);
    const encoded = encodePolyline(latLng);
    const params = new URLSearchParams(location.search);
    params.set("fav", encoded);
    history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
  }

  /**
   * URLからお気に入りを復元
   */
  function restoreFromUrl() {
    const params = new URLSearchParams(location.search);
    if (params.has("fav")) {
      const decoded = decodePolyline(params.get("fav"));
      decoded.forEach(([lat, lng]) => addFavorite([lng, lat]));
    }
  }

  // ボタン処理
  // document.getElementById("clearBtn").onclick = clearAll;
  document.getElementById("clearTrajBtn").onclick = () => {
    trajectory.splice(0);
    updateTrajectory();
  };
  document.getElementById("addFavBtn").onclick = () => {
    if (trajectory.length === 0) return;
    // 現在位置（軌跡の最後の座標）をお気に入りに追加
    addFavorite(trajectory.at(-1));
  };
  document.getElementById("delFavBtn").onclick = () => {
    // お気に入りの最後のマーカーを削除
    const m = favorites.pop();
    if (m) m.remove();
  };
  document.getElementById("saveUrlBtn").onclick = saveUrl;

  // 現在位置トラッキング
  const geolocate = new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
  });
  map.addControl(geolocate);
  // スケール表示
  map.addControl(new maplibregl.ScaleControl({ unit: "metric" }));

  geolocate.on("geolocate", (pos) => {
    const { latitude, longitude } = pos.coords;
    const coord = [longitude, latitude];
    trajectory.push(coord);
    // 軌跡更新
    updateTrajectory();
    // 現在地を中心に
    map.easeTo({ center: coord, zoom: 16, duration: 500 });
  });
  geolocate.on("error", (err) => {
    console.warn("位置情報取得エラー", err);
  });
})();
