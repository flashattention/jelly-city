// Overpass 질문 (지도 도구 hangang-map.mjs · 서울 미리 받기 seoul-osm-prefetch.mjs 가 같이 쓴다). $B = 위경도 상자
export const QUERIES = {
  buildings: 'way["building"]($B);relation["building"]($B);way["building:part"]($B);',
  water_far: 'way["natural"="water"]["water"="river"]($B);relation["natural"="water"]["water"="river"]($B);way["place"~"island|islet"]($B);relation["place"~"island|islet"]($B);',
  stations: 'node["railway"="subway_entrance"]($B);node["railway"="station"]($B);node["public_transport"="station"]($B);',
  land: 'way["natural"="water"]($B);relation["natural"="water"]($B);way["waterway"="riverbank"]($B);relation["waterway"="riverbank"]($B);way["place"~"island|islet"]($B);relation["place"~"island|islet"]($B);way["leisure"~"park|pitch|playground|garden"]($B);relation["leisure"="park"]($B);way["landuse"~"grass|recreation_ground|forest|meadow"]($B);way["natural"~"wood|scrub|grassland|wetland|sand|beach"]($B);relation["natural"~"wood|wetland|grassland"]($B);way["highway"]($B);way["railway"~"rail|subway"]($B);way["man_made"~"bridge|pier"]($B);',
  pois: 'node["amenity"~"^(cafe|restaurant|fast_food|bar|pub|ice_cream|food_court)$"]["name"]($B);node["shop"~"^(convenience|bakery|pastry|supermarket|deli)$"]["name"]($B);',
};
