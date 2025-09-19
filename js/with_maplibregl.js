(() => {
  "use strict";

  const MAX_PITCH = 70;
  const DEFAULT_PITCH = 65;

  /**
   * 座標列をCSV文字列に変換
   * @param {Array.<[number, number]>} latLngs 座標リスト
   * @returns CSV文字列
   */
  function _latlngs_csv(latLngs) {
    const header = "lat,lng";
    const body = latLngs.map(e => e.join(",")).join("\n");
    return header + "\n" + body;
  }

  /**
   * 座標列をCSVとしてダウンロード[
   * @param {String} filename ファイル名
   * @param {Array.<[number, number]>} latLngs 座標リスト
   */
  function downloadCSV(filename, latLngs) {
    // 
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    // リンク生成
    const downloadLink = document.createElement("a");
    downloadLink.download = filename;
    // ファイル情報設定
    const blob = new Blob([bom, _latlngs_csv(latLngs)]);
    downloadLink.href = URL.createObjectURL(blob, { type: "text/csv" });
    downloadLink.dataset.downloadurl = ["text/csv", downloadLink.download, downloadLink.href].join(":");
    // イベント実行
    downloadLink.click();
  }

  /**
   * トースト表示
   * @param {String} msg 表示メッセージ文字列
   */
  function showToast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.remove("hide");
    setTimeout(() => el.classList.add("hide"), 2500);
  }

  const getTileStyle = (() => {
    const tileStyles = {
      osm_vec: "https://tile.openstreetmap.jp/styles/osm-bright-ja/style.json",
      gsi_vec: "https://gsi-cyberjapan.github.io/gsivectortile-mapbox-gl-js/pale.json",
    };

    const tileSources = {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors"
      },
      gsi_std: {
        type: "raster",
        tiles: ["https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "地理院タイル"
      },
      gsi_photo: {
        type: "raster",
        tiles: ["https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg"],
        tileSize: 256,
        attribution: "地理院タイル（航空写真）"
      },
      google: {
        type: "raster",
        tiles: ["https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"], // lyrs=m=地図, s=衛星, y=ハイブリッド
        tileSize: 256,
        attribution: "© Google"
      },
      // 3D都市モデル（Project PLATEAU）東京都23区（2020年度）建物データ
      "plateau-bldg": {
        type: "vector",
        tiles: ["https://indigo-lab.github.io/plateau-lod2-mvt/{z}/{x}/{y}.pbf"],
        minzoom: 10,
        maxzoom: 16,
        attribution: "<a href='https://github.com/indigo-lab/plateau-lod2-mvt'>plateau-lod2-mvt by indigo-lab</a>"
          + "(<a href='https://www.mlit.go.jp/plateau/'>国土交通省 Project PLATEAU</a> のデータを加工して作成)",
      },
    };

    function getTileStyle(sourceId, with3d) {
      const style = tileStyles[sourceId];
      document.getElementById("with3D").disabled = !!style;
      if (style) {
        return style;
      }
      const layers = [
        { id: "basemap", type: "raster", source: sourceId },
      ]
      if (with3d) {
        const ratio = parseFloat(document.getElementById("ratioHeight").value) || 0;
        layers.push({
          id: "bldg",
          type: "fill-extrusion",
          source: "plateau-bldg",
          // ベクタタイルソースから使用するレイヤ
          "source-layer": "bldg",
          paint: {
            // 高さ
            "fill-extrusion-height": ["*", ["get", "z"], ratio],
            // 塗りつぶしの色
            "fill-extrusion-color": "#797979",
            // 透明度
            "fill-extrusion-opacity": 0.4,
          },
        });
      }
      return {
        version: 8,
        sources: tileSources,
        layers,
      };
    }
    return getTileStyle;
  })();
  const defaultStyle = getTileStyle(document.getElementById("basemapSelect").value, document.getElementById("with3D"));

  /**
   * Map オブジェクト
   * @type {maplibregl.Map}
   */
  const map = new maplibregl.Map({
    container: "map",
    style: defaultStyle,
    center: [139.72195, 35.62513],
    zoom: 14,
    attributionControl: false,  // 既存Attributionを非表示
    maplibreLogo: true,
    maxPitch: MAX_PITCH,
    pitch: DEFAULT_PITCH,
  });

  function isEditableFav() {
    return document.getElementById("editableFav").checked;
  }
  function isLockMap() {
    return document.getElementById("lockMap").checked;
  }

  /** ズーム更新イベント対応 */
  function onUpdatedZoom() {
    const zoom = map.getZoom();
    // 値表示
    document.getElementById("v_zoom").textContent = zoom.toFixed(1);
  }
  /** 方位変更イベント対応 */
  function onUpdatedBearing() {
    const bearing = map.getBearing();
    document.getElementById("v_bearing").textContent = bearing.toFixed(1);
  }
  /** 傾斜更新イベント対応 */
  function onUpdatedPitch() {
    const pitch = map.getPitch();
    // 値表示
    document.getElementById("v_pitch").textContent = pitch.toFixed(1);
    // ボタン無効化切替
    document.getElementById("addPitch").disabled = pitch >= MAX_PITCH;
    document.getElementById("subPitch").disabled = pitch <= 0;
    document.getElementById("zeroPitch").disabled = pitch == 0;
  }
  /** 軌跡更新イベント対応 */
  function onUpdatedTrajectory() {
    const nTraj = trajectory.length;
    const locked = !isEditableFav();
    // 値表示
    document.getElementById("n_traj").textContent = nTraj;
    // ボタン無効化切替
    document.getElementById("clearTrajBtn").disabled = nTraj <= 1;
    document.getElementById("addFavBtn").disabled = locked || nTraj === 0;
  }
  /** お気に入り更新イベント対応 */
  function onUpdatedFavorite() {
    const nFav = favorites.length;
    const nTraj = trajectory.length;
    const locked = !isEditableFav();
    // 値表示
    document.getElementById("n_fav").textContent = nFav;
    // ボタン無効化切替
    document.getElementById("addFavBtn").disabled = locked || nTraj === 0;
    document.getElementById("delFavBtn").disabled = locked || nFav === 0;
    document.getElementById("downloadCsvBtn").disabled = nFav === 0;
  }

  // タイル切り替え
  function changeTile() {
    const sourceId = document.getElementById("basemapSelect").value;
    const with3d = document.getElementById("with3D").checked;
    const style = getTileStyle(sourceId, with3d);
    map.setStyle(style);
    // 初期表示更新
    updateFavorites();
    updateTrajectory();
  }
  document.getElementById("basemapSelect").addEventListener("change", changeTile);
  document.getElementById("with3D").addEventListener("change", changeTile);
  document.getElementById("ratioHeight").addEventListener("change", changeTile);

  document.getElementById("redraw").addEventListener("click", () => {
    map.redraw();
  });
  document.getElementById("rotateRight").addEventListener("click", () => {
    if (isLockMap()) return;
    const bearing = map.getBearing() - 5;
    map.easeTo({ bearing, duration: 200 });
  });
  document.getElementById("rotateLeft").addEventListener("click", () => {
    if (isLockMap()) return;
    const bearing = map.getBearing() + 5;
    map.easeTo({ bearing, duration: 200 });
  });
  document.getElementById("rotateN").addEventListener("click", () => {
    if (isLockMap()) return;
    map.easeTo({ bearing: 0, duration: 200 });
  });
  document.getElementById("rotateS").addEventListener("click", () => {
    if (isLockMap()) return;
    map.easeTo({ bearing: 180, duration: 200 });
  });
  document.getElementById("rotateE").addEventListener("click", () => {
    if (isLockMap()) return;
    map.easeTo({ bearing: 90, duration: 200 });
  });
  document.getElementById("rotateW").addEventListener("click", () => {
    if (isLockMap()) return;
    map.easeTo({ bearing: -90, duration: 200 });
  });
  document.getElementById("addPitch").addEventListener("click", () => {
    if (isLockMap()) return;
    const pitch_old = map.getPitch();
    const d = pitch_old >= 60 ? 1 : 5 * Math.cos(pitch_old * Math.PI / 180);
    const pitch = Math.min(pitch_old + d, MAX_PITCH);
    map.easeTo({ pitch, duration: 200 });
  });
  document.getElementById("subPitch").addEventListener("click", () => {
    if (isLockMap()) return;
    const pitch_old = map.getPitch();
    const d = pitch_old >= 60 ? 1 : 5 * Math.cos(pitch_old * Math.PI / 180);
    const pitch = Math.max(pitch_old - d, 0);
    map.easeTo({ pitch, duration: 200 });
  });
  document.getElementById("zeroPitch").addEventListener("click", () => {
    if (isLockMap()) return;
    map.easeTo({ pitch: 0, duration: 200 });
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
    const trajectorySource = getTrajectorySource();
    if (trajectory.length === 0) {
      trajectorySource.setData({ type: "FeatureCollection", features: [] });
    } else {
      trajectorySource.setData({
        type: "FeatureCollection", features: [{
          type: "Feature",
          geometry: { type: "LineString", coordinates: trajectory.slice(0) }
        }]
      });
    }
    // 現在地点近傍円
    const circleSource = getNowAreaSource();
    if (trajectory.length === 0) {
      circleSource.setData({ type: "FeatureCollection", features: [] });
    } else {
      const radius = parseInt(document.getElementById("fav_radius").value) || 40;
      const circle = turf.circle(trajectory.at(-1), radius / 1000, { steps: 48 });
      circleSource.setData(circle);
    }
    onUpdatedTrajectory();
  }

  // 軌跡レイヤを用意
  function getTrajectorySource() {
    const sourceId = "trajectory";
    let source = map.getSource(sourceId);
    if (!source) {
      map.addSource(sourceId, {
        type: "geojson",
        lineMetrics: true,
        data: { type: "FeatureCollection", features: [] },
      });
      source = map.getSource(sourceId);
    }
    if (!map.getLayer("trajectory-line")) {
      map.addLayer({
        id: "trajectory-line",
        type: "line",
        source: sourceId,
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
    }
    return source;
  }
  // お気に入り近傍円レイヤを用意
  function getFavoriteAreaSource() {
    const sourceId = "favorite-area";
    let source = map.getSource(sourceId);
    if (!source) {
      map.addSource(sourceId, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      source = map.getSource(sourceId);
    }
    if (!map.getLayer("favorite-area-fill")) {
      map.addLayer({
        id: "favorite-area-fill",
        type: "fill",
        source: sourceId,
        paint: {
          // "fill-color": "#58BE89",
          // "fill-color": "#FF7F005F",
          "fill-color": [
            "match", ["get", "index"],
            0, "#FF00007F",  // 最後の円を赤で強調
            "#FF7F005F"
          ],
          "fill-opacity": 0.3,
        },
      });
    }
    if (!map.getLayer("favorite-area-line")) {
      map.addLayer({
        id: "favorite-area-line",
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#FF00007F",
          "line-opacity": 0.7,
          "line-width": 2,
        },
      });
    }
    return source;
  }
  // 現在地点近傍円レイヤを用意
  function getNowAreaSource() {
    const sourceId = "now-area";
    let source = map.getSource(sourceId);
    if (!source) {
      map.addSource(sourceId, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      source = map.getSource(sourceId);
    }
    if (!map.getLayer("now-area-line")) {
      map.addLayer({
        id: "now-area-line",
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "blue",
          "line-opacity": 0.6,
          "line-width": 2,
        },
      });
    }
    return source;
  }

  map.on("load", () => {
    // 現在位置トラッキング開始
    geolocate.trigger();

    // URLから復元
    restoreFromUrl();

    // 初期表示更新
    onUpdatedZoom();
    onUpdatedBearing();
    onUpdatedPitch();
    updateFavorites();
    updateTrajectory();
  });
  map.on("zoom", onUpdatedZoom);
  map.on("rotate", onUpdatedBearing)
  map.on("pitch", onUpdatedPitch);

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
      color: "#ADFF2F",
      draggable: isEditableFav(),
      className: "favorite-marker",
    }).setLngLat(lngLat).addTo(map);
    // クリックした or ドラッグしているマーカーをお気に入りリストの最後に移動
    marker.getElement().addEventListener("click", () => updateFavorites(marker));
    marker.on("drag", () => updateFavorites(marker));
    favorites.push(marker);
  }

  function destination(lon1, lat1, distance, bearing) {
    const R = 6371000;  // 地球の半径（メートル）
    const lat1Rad = lat1 * Math.PI / 180;
    const lon1Rad = lon1 * Math.PI / 180;
    const bearingRad = bearing * Math.PI / 180;
    // 目的地の緯度を計算 (ラジアン)
    const lat2Rad = Math.asin(
      Math.sin(lat1Rad) * Math.cos(distance / R) +
      Math.cos(lat1Rad) * Math.sin(distance / R) * Math.cos(bearingRad)
    );
    // 目的地の経度を計算 (ラジアン)
    const lon2Rad = lon1Rad + Math.atan2(
      Math.sin(bearingRad) * Math.sin(distance / R) * Math.cos(lat1Rad),
      Math.cos(distance / R) - Math.sin(lat1Rad) * Math.sin(lat2Rad)
    );
    // 緯度経度を度に変換
    const lat2 = lat2Rad * 180 / Math.PI;
    const lon2 = lon2Rad * 180 / Math.PI;
    return [lon2, lat2];
  }
  function moveFav(distance, bearing) {
    if (favorites.length === 0) return;
    const marker = favorites.at(-1);
    const src = marker.getLngLat();
    const dst = destination(src.lng, src.lat, distance, bearing);
    console.log(`${src} ${dst}`);
    marker.setLngLat(dst);
  }
  ["N", "NE", "E", "SE", "S", "SW", "W", "NW"].forEach((e, i) => {
    document.getElementById("moveFav" + e).addEventListener("click", () => {
      if (!isEditableFav()) return;
      moveFav(1, i * 45);
      updateFavorites();
    });
  });

  /**
   * お気に入りの表示(近傍円など)を更新
   */
  function updateFavorites(markerFocused) {
    if (markerFocused) {
      const idx = favorites.indexOf(markerFocused);
      favorites.splice(idx, 1);
      favorites.push(markerFocused);
    }
    const radius = parseInt(document.getElementById("fav_radius").value) || 40;
    const circleSource = getFavoriteAreaSource();
    const features = [];
    const locked = !isEditableFav();
    favorites.toReversed().forEach((marker, index) => {
      marker.setOpacity(locked ? 0.4 : 0.6);
      const { lat, lng } = marker.getLngLat();
      const circle = turf.circle([lng, lat], radius / 1000, { steps: 24, properties: { index } });
      features.push(circle);
    });
    const empty = favorites.length === 0;
    if (!empty && !locked) {
      // 最後のマーカーを強調
      favorites.at(-1).setOpacity(1);
    }
    circleSource.setData({ type: "FeatureCollection", features });
    onUpdatedFavorite();
  }

  document.getElementById("fav_radius").addEventListener("change", e => {
    updateTrajectory();
    updateFavorites();
  });

  /**
   * お気に入りをURLクエリに保存
   */
  async function saveUrl(share) {
    const params = new URLSearchParams(location.search);
    if (favorites.length > 0) {
      const latLngs = favorites.map(m => m.getLngLat()).map(p => [p.lat, p.lng]);
      const encoded = encodePolyline(latLngs);
      params.set("fav", encoded);
      history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
      if (share) {
        const shareData = {
          title: "favorite points",
          // text: "",
          url: location.href,
        };
        try {
          await navigator.share(shareData);
          showToast("共有しました");
        } catch (err) {
          showToast(`エラー: ${err}`);
        }
      } else {
        showToast("URLクエリにお気に入り座標を追加");
      }
    } else {
      history.replaceState(null, "", location.pathname);
      showToast("URLクエリをリセット");
    }
  }

  /**
   * URLからお気に入りを復元
   */
  function restoreFromUrl() {
    const params = new URLSearchParams(location.search);
    for (const fav of params.getAll("fav")) {
      const decoded = decodePolyline(fav);
      decoded.forEach(([lat, lng]) => addFavorite([lng, lat]));
    }
  }

  // ボタン処理
  document.getElementById("resetView").addEventListener("click", () => {
    if (isLockMap()) return;
    map.easeTo({
      center: trajectory.at(-1),
      bearing: orientation,
      zoom: 18,
      pitch: DEFAULT_PITCH,
      duration: 500,
    });
    document.getElementById("fav_radius").value = 40;
  });
  // document.getElementById("clearBtn").addEventListener("click", clearAll;
  document.getElementById("clearTrajBtn").addEventListener("click", () => {
    if (trajectory.length > 1) {
      trajectory.splice(0, trajectory.length - 1);  // 現在位置は残す
      updateTrajectory();
      showToast("軌跡をクリア");
    } else {
      showToast("軌跡が空");
    }
  });
  document.getElementById("addFavBtn").addEventListener("click", () => {
    if (!isEditableFav()) return;
    if (trajectory.length > 0) {
      // 現在位置（軌跡の最後の座標）をお気に入りに追加
      addFavorite(trajectory.at(-1));
      updateFavorites();
    } else {
      showToast("現在位置が不明");
    }
  });
  document.getElementById("delFavBtn").addEventListener("click", () => {
    if (!isEditableFav()) return;
    // お気に入りの最後のマーカーを削除
    const m = favorites.pop();
    if (m) {
      m.remove();
      updateFavorites();
    } else {
      showToast("お気に入りが空");
    }
  });
  document.getElementById("saveUrlBtn").addEventListener("click", () => saveUrl());
  document.getElementById("shareUrlBtn").addEventListener("click", () => saveUrl(true));
  document.getElementById("downloadCsvBtn").addEventListener("click", () => {
    if (favorites.length > 0) {
      const latLngs = favorites.map(m => m.getLngLat()).map(p => [p.lat, p.lng]);
      downloadCSV("favorites.csv", latLngs);
    } else {
      showToast("お気に入りが空");
    }
  });
  document.getElementById("editableFav").addEventListener("change", () => {
    const draggable = isEditableFav();
    favorites.forEach(e => e.setDraggable(draggable));
    updateFavorites();
  });
  document.getElementById("lockMap").addEventListener("change", () => {
    const locked = isLockMap();
    const handlers = [
      map.doubleClickZoom,
      map.dragPan,
      map.dragRotate,
      map.keyboard,
      map.scrollZoom,
      map.touchPitch,
      map.touchZoomRotate,
    ];
    if (locked) {
      handlers.forEach(e => e.disable());
    } else {
      handlers.forEach(e => e.enable());
    }
  });

  /**
   * 現在位置トラッキング用のコントロール
   * @type {maplibregl.GeolocateControl}
   */
  const geolocate = new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showAccuracyCircle: true,
    fitBoundsOptions: { maxZoom: 18, offset: [0, 30] },
  });

  // Map の コントロールを追加
  // - Attributionを折りたたみ表示
  // - スケール表示
  // - ズーム・回転操作
  // - 現在位置トラッキング
  map.addControl(new maplibregl.AttributionControl({
    compact: true,
    customAttribution: '<a href="https://github.com/ueda-ftl/geolocation-trial">github</a>',
  }));
  map.addControl(new maplibregl.ScaleControl({ unit: "metric" }));
  map.addControl(new maplibregl.NavigationControl());
  map.addControl(geolocate);

  // 現在位置取得イベント
  geolocate.on("geolocate", (pos) => {
    const { latitude, longitude } = pos.coords;
    // if (heading != null) {
    //   showToast(heading);
    //   map.setBearing(heading);
    //   onUpdatedBearing();
    // }
    const coord = [longitude, latitude];
    trajectory.push(coord);
    // 軌跡更新
    updateTrajectory();
  });
  geolocate.on("error", err => {
    console.warn("位置情報取得エラー", err);
  });
  let orientation = 0.0;
  window.addEventListener("deviceorientation", (e) => {
    // const a = e.absolute;  //方位が地球座標フレームかデバイス任意フレームか
    const z = e.alpha;  //z軸 0～360
    // const x = e.beta;  //x軸 -180～180
    // const y = e.gamma;  //y軸 -90～90
    if (z != null) {
      orientation = z;
    }
  });

  // テスト用ダミーとして軌跡を描画
  if (false) {
    setInterval(() => {
      const [lng, lat] = trajectory.length === 0 ? [139.72195, 35.62513] : trajectory.at(-1);
      const dLng = (Math.random() - 0.5) / 5000;
      const dLat = (Math.random() - 0.5) / 5000;
      trajectory.push([lng + dLng, lat + dLat]);
      updateTrajectory();
    }, 1000);
  }
})();
