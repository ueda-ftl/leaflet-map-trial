(() => {
  "use strict";

  /**
   * お気に入り座標に対する近傍円の半径 [m]
   * @type {Number}
   */
  const FAVORITE_RADIUS = 30;

  /**
   * 軌跡の最大表示点数
   * @type {Number}
   */
  const TRAJECTORY_POINTS_MAX = 100;

  /**
   * Map オブジェクト
   * @type {maplibregl.Map}
   */
  const map = new maplibregl.Map({
    container: "map",
    style: "https://tile.openstreetmap.jp/styles/osm-bright-ja/style.json",
    center: [139.72195, 35.62513],
    zoom: 14,
    attributionControl: false,  // 既存Attributionを非表示
    maplibreLogo: true,
  });

  /**
   * 軌跡
   * @type {Array.<[number, number]>}
   */
  const trajectory = [];

  /**
   * 軌跡表示を更新
   */
  function updateTrajectory() {
    const trajectorySource = map.getSource("trajectory");
    if (!trajectorySource) return;
    const features = [];
    if (trajectory.length > 0) {
      const coordinates = trajectory.slice(-TRAJECTORY_POINTS_MAX);
      features.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates }
      });
    }
    trajectorySource.setData({ type: "FeatureCollection", features});
  }

  // GeoJSON ソース追加
  map.on("load", () => {
    // 軌跡レイヤを用意
    map.addSource("trajectory", {
      type: "geojson",
      lineMetrics: true,
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "trajectory-line",
      type: "line",
      source: "trajectory",
      paint: {
        "line-color": "green",
        "line-width": 3,
        "line-gradient": [
          "interpolate",
          ["linear"],
          ["line-progress"],
          0, "cyan",
          1, "green"   
        ],
      },
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
    });
    // お気に入り近傍円レイヤを用意
    map.addSource("favorite-area", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "favorite-area-fill",
      type: "fill",
      source: "favorite-area",
      paint: {
        // "fill-color": "#58BE89",
        "fill-color": [
          "match", ["get", "index"],
          0, "#FF00007F",  // 最後の円を赤で強調
          "#FF7F005F"
        ],
        "fill-opacity": 0.5
      },
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
    const marker = new maplibregl.Marker({
      color: "red",
      draggable: true,
      className: "favorite-marker",
    }).setLngLat(lngLat).addTo(map);
    // クリックした or ドラッグしているマーカーをお気に入りリストの最後に移動
    marker.getElement().addEventListener("click", () => updateFavorites(marker));
    marker.on("drag", () => updateFavorites(marker));
    favorites.push(marker);
    updateFavorites();
  }

  /**
   * お気に入りの表示(近傍円など)を更新
   */
  function updateFavorites(markerFocused) {
    if (markerFocused) {
      const idx = favorites.indexOf(markerFocused);
      favorites.splice(idx, 1);
      favorites.push(markerFocused);
    }
    const radius = FAVORITE_RADIUS;
    const circleSource = map.getSource("favorite-area");
    if (!circleSource) return;
    const features = [];
    favorites.toReversed().forEach((marker, index) => {
      marker.setOpacity(0.6);
      const {lat, lng} = marker.getLngLat();
      const circle = turf.circle([lng, lat], radius / 1000, { steps: 24, properties: { index } });
      features.push(circle);
    });
    favorites.at(-1).setOpacity(0.8); // 最後のマーカーを強調
    circleSource.setData({ type: "FeatureCollection", features});
  }

  /**
   * 全削除
   */
  function clearAll() {
    favorites.forEach(m => m.remove());
    favorites.splice(0);
    trajectory.splice(0);
    updateTrajectory();
    updateFavorites();
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
    if (m) {
      m.remove();
      updateFavorites();
    }
  };
  document.getElementById("saveUrlBtn").onclick = saveUrl;

  /**
   * 現在位置トラッキング用のコントロール
   * @type {maplibregl.GeolocateControl}
   */
  const geolocate = new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    showAccuracyCircle: false,
    trackUserLocation: true,
  });

  // Map の コントロールを追加
  // - Attributionを折りたたみ表示
  // - スケール表示
  // - ズーム・回転操作
  // - 現在位置トラッキング
  map.addControl(new maplibregl.AttributionControl({ compact: true }));
  map.addControl(new maplibregl.ScaleControl({ unit: "metric" }));
  map.addControl(new maplibregl.NavigationControl());
  map.addControl(geolocate);

  // 現在位置取得イベント
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

  // テスト用ダミーとして軌跡を描画
  if (false) {
    setInterval(() => {
      if (trajectory.length === 0) return;
      const [lng, lat] = trajectory.at(-1);
      const dLng = (Math.random() - 0.5) / 5000;
      const dLat = (Math.random() - 0.5) / 5000;
      trajectory.push([lng + dLng, lat + dLat]);
      updateTrajectory();
    }, 1000);
  }
})();
