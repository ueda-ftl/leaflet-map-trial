// Google Polyline Encoding によるデータ変換関数実装
// ※ ChatGPT自動生成コード

function encodePolyline(coords, precision = 5) {
  let factor = Math.pow(10, precision);
  let output = "";
  let prevLat = 0, prevLng = 0;

  for (let [lat, lng] of coords) {
    let ilat = Math.round(lat * factor);
    let ilng = Math.round(lng * factor);
    let dlat = ilat - prevLat;
    let dlng = ilng - prevLng;
    output += encodeSignedNumber(dlat) + encodeSignedNumber(dlng);
    prevLat = ilat;
    prevLng = ilng;
  }
  return output;
}

function encodeSignedNumber(num) {
  let sgn_num = num << 1;
  if (num < 0) sgn_num = ~sgn_num;
  return encodeNumber(sgn_num);
}

function encodeNumber(num) {
  let output = "";
  while (num >= 0x20) {
    output += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
    num >>= 5;
  }
  output += String.fromCharCode(num + 63);
  return output;
}

function decodePolyline(str, precision = 5) {
  let index = 0, lat = 0, lng = 0;
  let coordinates = [];
  let factor = Math.pow(10, precision);

  while (index < str.length) {
    let result = 1, shift = 0, b;
    do {
      b = str.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    let dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    result = 1;
    shift = 0;
    do {
      b = str.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    let dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    coordinates.push([lat / factor, lng / factor]);
  }
  return coordinates;
}
