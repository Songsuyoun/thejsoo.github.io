/**
 * ============================================
 * 더제이수 당일배송 위젯 v4.1
 * Cafe24 상세페이지 전용 — 독립 실행 파일
 * ============================================
 *
 * [설치 방법]
 * 카페24 관리자 → 디자인 편집 → 상세페이지 레이아웃(product/detail.html)에서
 * 구매하기 버튼 위 원하는 위치에 아래 한 줄 추가:
 *
 *   <script src="https://songsuyoun.github.io/cafe24-delivery-widget.js"></script>
 *
 * 또는 특정 위치에 직접 지정:
 *   <div id="jsoo-delivery-widget"></div>
 *   <script src="https://songsuyoun.github.io/cafe24-delivery-widget.js"></script>
 *
 * [여백 조정]
 * 아래 CONFIG에서 숫자만 변경:
 *   MARGIN_TOP: 20   → 위젯 위 여백 (px)
 *   MARGIN_BOTTOM: 16 → 위젯 아래 여백 (px)
 *
 * [노출 조건]
 * MADE + PREMIUM BRAND 카테고리(23개) 상품에서만 자동 표시
 * 다른 카테고리에서는 아무것도 안 뜸
 *
 * [상태 표시]
 * - 당일배송 (검정) : 가용재고 있음
 * - N/N 이후 순차배송 (빨강) : 예약배송
 * - 품절 (회색+취소선)
 */

(function() {
  'use strict';

  // ============================================================
  // 설정 — 여기만 수정하면 됨
  // ============================================================
  var CONFIG = {
    GAS_URL: 'https://script.google.com/macros/s/AKfycbz1kR_wFxI3Hd3o9KwLvvti9IQcstZjaLzNgSkIJ9l3BA4S7VFGqfaKdr1Z1natPj0wZA/exec',
    CUTOFF_HOUR: 16,            // 당일발송 마감 시간
    CONTAINER_ID: 'jsoo-delivery-widget',
    CACHE_KEY: 'jsoo_dlv_',
    CACHE_DURATION: 5 * 60 * 1000,  // 5분 캐시
    MARGIN_TOP: 20,             // ← 위젯 위 여백 (px)
    MARGIN_BOTTOM: 16,          // ← 위젯 아래 여백 (px)
    TEST_CODE: '',    // ← 테스트용 (나중에 '' 로 비우면 됨)

    // MADE + PREMIUM BRAND 카테고리 번호 (이 카테고리에서만 위젯 표시)
    ALLOWED_CATEGORIES: [
      180, 133, 135, 136, 137, 138, 139, 140, 141, 214,
      196, 197, 198, 216, 233, 181, 183, 184, 185, 186, 187, 188, 189
    ]
  };

  // ============================================================
  // 카테고리 체크
  // ============================================================
  function isAllowedCategory() {
    var found = false;

    // 방법1: 카페24 전역변수 category_no
    try {
      if (typeof category_no !== 'undefined' && category_no) {
        if (CONFIG.ALLOWED_CATEGORIES.indexOf(Number(category_no)) !== -1) return true;
      }
    } catch(e) {}

    // 방법2: URL의 cate_no 파라미터
    try {
      var params = new URLSearchParams(window.location.search);
      var cateNo = params.get('cate_no');
      if (cateNo && CONFIG.ALLOWED_CATEGORIES.indexOf(Number(cateNo)) !== -1) return true;
    } catch(e) {}

    // 방법3: 페이지 내 카테고리 경로 링크
    try {
      var links = document.querySelectorAll('.xans-product-detail .path a, .xans-product-headcategory a');
      for (var i = 0; i < links.length; i++) {
        var href = links[i].getAttribute('href') || '';
        var m = href.match(/cate_no=(\d+)/);
        if (m && CONFIG.ALLOWED_CATEGORIES.indexOf(Number(m[1])) !== -1) return true;
      }
    } catch(e) {}

    // 방법4: hidden input
    try {
      var inp = document.querySelector('input[name="cate_no"]');
      if (inp && inp.value && CONFIG.ALLOWED_CATEGORIES.indexOf(Number(inp.value)) !== -1) return true;
    } catch(e) {}

    return false;
  }

  // ============================================================
  // 카페24 상품코드 감지
  // ============================================================
  function getProductCode() {
    if (CONFIG.TEST_CODE) return CONFIG.TEST_CODE;
    if (typeof product_code !== 'undefined' && product_code) return product_code;
    try { var m = document.querySelector('.xans-product-detail')?.innerHTML.match(/P000[A-Z0-9]+/); if (m) return m[0]; } catch(e) {}
    try { if (typeof EC_FRONT_JS_CONFIG_SHOP !== 'undefined') return EC_FRONT_JS_CONFIG_SHOP.product_code; } catch(e) {}
    var meta = document.querySelector('meta[property="product:code"]') || document.querySelector('meta[name="product_code"]');
    if (meta) return meta.getAttribute('content');
    var inp = document.querySelector('input[name="product_code"]');
    if (inp) return inp.value;
    return null;
  }

  // ============================================================
  // GAS 데이터 조회 (JSONP + 캐시)
  // ============================================================
  function fetchStockData(code, callback) {
    try {
      var cached = sessionStorage.getItem(CONFIG.CACHE_KEY + code);
      if (cached) {
        var p = JSON.parse(cached);
        if (Date.now() - p.t < CONFIG.CACHE_DURATION) { callback(p.d); return; }
      }
    } catch(e) {}

    var cb = 'jsooD_' + Date.now();
    window[cb] = function(data) {
      try { sessionStorage.setItem(CONFIG.CACHE_KEY + code, JSON.stringify({ t: Date.now(), d: data })); } catch(e) {}
      callback(data);
      delete window[cb];
      var el = document.getElementById('jsoo_s_' + cb);
      if (el) el.remove();
    };

    var s = document.createElement('script');
    s.id = 'jsoo_s_' + cb;
    s.src = CONFIG.GAS_URL + '?action=product&code=' + encodeURIComponent(code) + '&callback=' + cb;
    s.onerror = function() { delete window[cb]; callback(null); };
    document.head.appendChild(s);
  }

  // ============================================================
  // 날짜 포맷: "2026-11-26" → "11/26"
  // ============================================================
  function fmtDate(d) { if (!d) return ''; var m = d.match(/(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return parseInt(m[2]) + '/' + parseInt(m[3]); var dt = new Date(d); if (!isNaN(dt.getTime())) return (dt.getMonth()+1) + '/' + dt.getDate(); return d; }

  // ============================================================
  // HTML 이스케이프
  // ============================================================
  function esc(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ============================================================
  // 위젯 렌더링
  // ============================================================
  function renderWidget(container, data) {
    var opts = (data.options || []).filter(function(o) { return o.status !== 'check'; });
    if (opts.length === 0) { container.style.display = 'none'; return; }

    var h = '';
    h += '<style>' +
      '.jdw{font-family:Pretendard,-apple-system,BlinkMacSystemFont,system-ui,Roboto,sans-serif;' +
        'border:1px solid #231F20;margin:' + CONFIG.MARGIN_TOP + 'px 0 ' + CONFIG.MARGIN_BOTTOM + 'px 0;background:#fff}' +
      '.jdw-hd{display:flex;justify-content:center;align-items:center;gap:8px;padding:14px 18px;cursor:pointer;user-select:none}' +
      '.jdw-hd:hover{background:#fafafa}' +
      '.jdw-hd-t{font-size:13px;font-weight:400;color:#111;letter-spacing:.5px}' +
      '.jdw-arr{display:flex;align-items:center;transition:transform .25s ease}' +
      '.jdw.open .jdw-arr{transform:rotate(180deg)}' +
      '.jdw-bd{display:none;border-top:1px solid #231F20}' +
      '.jdw.open .jdw-bd{display:block}' +
      '.jdw-nt{padding:14px 18px;background:#f9f9f9;border-bottom:1px solid #f0f0f0}' +
      '.jdw-nt-i{font-size:11px;color:#888;line-height:1.7;letter-spacing:.3px}' +
      '.jdw-ol{padding:4px 0}' +
      '.jdw-op{display:flex;justify-content:space-between;align-items:center;padding:11px 18px;border-bottom:1px solid #f5f5f5}' +
      '.jdw-op:last-child{border-bottom:none}' +
      '.jdw-on{font-size:12px;color:#111;font-weight:400;letter-spacing:.5px}' +
      '.jdw-st{font-size:11px;font-weight:400;letter-spacing:.3px;white-space:nowrap}' +
      '.jdw-st-a{color:#111}' +
      '.jdw-st-p{color:#c62828}' +
      '.jdw-st-s{color:#999;text-decoration:line-through}' +
      '@media(max-width:600px){.jdw-hd{padding:13px 15px}.jdw-nt{padding:12px 15px}.jdw-op{padding:10px 15px}}' +
    '</style>';

    h += '<div class="jdw">';

    // 헤더 (접기/펼치기)
    h += '<div class="jdw-hd" onclick="this.parentElement.classList.toggle(\'open\')">';
    h += '<span class="jdw-hd-t">실시간 재고 조회</span>';
    h += '<span class="jdw-arr"><svg width="12" height="7" viewBox="0 0 12 7" fill="none"><path d="M1 1L6 6L11 1" stroke="#111" stroke-width="1.2"/></svg></span>';
    h += '</div>';

    // 본문
    h += '<div class="jdw-bd">';

    // 안내
    h += '<div class="jdw-nt">';
    h += '<div class="jdw-nt-i">\xB7 당일발송 : 평일 오후 ' + CONFIG.CUTOFF_HOUR + '시 이전 결제 완료 시 당일출고</div>';
    h += '<div class="jdw-nt-i">\xB7 예약배송 상품과 함께 주문 시, 입고 완료 후 일괄 발송됩니다</div>';
    h += '</div>';

    // 옵션 목록
    h += '<div class="jdw-ol">';
    opts.forEach(function(o) {
      var name = esc(o.color);
      if (o.size && o.size !== '' && o.size !== '-') name += ', ' + esc(o.size);

      var txt = '', cls = '';
      if (o.status === 'available') {
        txt = '당일배송'; cls = 'jdw-st-a';
      } else if (o.status === 'preorder') {
        txt = o.expected_date ? fmtDate(o.expected_date) + ' 이후 순차배송' : '입고 후 순차배송';
        cls = 'jdw-st-p';
      } else if (o.status === 'soldout') {
        txt = '품절'; cls = 'jdw-st-s';
      }

      h += '<div class="jdw-op"><span class="jdw-on">' + name + '</span><span class="jdw-st ' + cls + '">' + txt + '</span></div>';
    });
    h += '</div>';

    h += '</div>'; // bd
    h += '</div>'; // jdw

    container.innerHTML = h;
  }

  // ============================================================
  // 초기화
  // ============================================================
  function init() {
    console.log('[JSOO위젯] 시작');

    // ★ 테스트 모드: 카테고리 필터 OFF
    // if (!isAllowedCategory()) return;

    // 구매버튼 찾기 (여러 셀렉터 시도)
    var container = document.getElementById(CONFIG.CONTAINER_ID);
    if (!container) {
      var buyBtn = document.querySelector('.xans-product-action') ||
                   document.querySelector('[module="product_action"]') ||
                   document.querySelector('.ec-base-button.gColumn') ||
                   document.querySelector('.btnArea') ||
                   document.querySelector('#btnBuy');

      console.log('[JSOO위젯] 구매버튼:', buyBtn ? buyBtn.className : 'NOT FOUND');

      if (buyBtn) {
        // btnBuy인 경우 부모의 부모로 올라가기
        if (buyBtn.id === 'btnBuy') buyBtn = buyBtn.closest('.ec-base-button') || buyBtn.parentElement;
        container = document.createElement('div');
        container.id = CONFIG.CONTAINER_ID;
        buyBtn.parentNode.insertBefore(container, buyBtn);
      } else {
        console.log('[JSOO위젯] 구매버튼을 찾지 못함 — 위젯 삽입 불가');
        return;
      }
    }

    var code = getProductCode();
    console.log('[JSOO위젯] 상품코드:', code);
    if (!code) return;

    fetchStockData(code, function(data) {
      console.log('[JSOO위젯] GAS 응답:', data ? 'OK' : 'FAIL', data);
      if (!data || !data.success || !data.options || data.options.length === 0) {
        container.style.display = 'none'; return;
      }
      renderWidget(container, data);
      console.log('[JSOO위젯] 렌더링 완료!');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 500); // 카페24 동적 로딩 대기
  }

})();
