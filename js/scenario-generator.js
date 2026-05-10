// ── SCENARIO GENERATOR ────────────────────────────────────────────────────────
// Loaded as a classic (non-module) script after the main inline script.
// Wraps termExec, adds fault library, UI panel, stats, and achievements.

(function () {
'use strict';

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
var DIFF_NAMES  = { 1:'Easy', 2:'Medium', 3:'Hard', 4:'Nightmare' };
var DIFF_FAULTS = { 1:1, 2:1, 3:2, 4:3 };
var DIFF_COLORS = { 1:'#00ff88', 2:'#d29922', 3:'#d87010', 4:'#f85149' };
var SGEN_STATS_KEY = 'cl-sgen-stats';

// ── HEALTHY BASE CONFIG ───────────────────────────────────────────────────────
// Mirrors Scenario 1 ("all-up") — source of truth for generated scenarios.
var HEALTHY_BASE = {
  briefing: '',
  layers: [],
  interfaces: [
    { name:'GigabitEthernet0/0', ip:'192.168.1.1', ok:'YES', method:'manual', status:'up', proto:'up' },
    { name:'GigabitEthernet0/1', ip:'10.0.0.1',    ok:'YES', method:'manual', status:'up', proto:'up' },
    { name:'GigabitEthernet0/2', ip:'unassigned',  ok:'YES', method:'unset',  status:'administratively down', proto:'down' }
  ],
  routes: [
    'Gateway of last resort is 10.0.0.254 to network 0.0.0.0',
    '',
    'S*   0.0.0.0/0 [1/0] via 10.0.0.254',
    'C    10.0.0.0/24 is directly connected, GigabitEthernet0/1',
    'L    10.0.0.1/32 is directly connected, GigabitEthernet0/1',
    'C    192.168.1.0/24 is directly connected, GigabitEthernet0/0',
    'L    192.168.1.1/32 is directly connected, GigabitEthernet0/0'
  ],
  pingSuccess: true,
  tracePath: [
    { hop:1, ip:'10.0.0.254', ms:[1,1,2] },
    { hop:2, ip:'203.0.113.1', ms:[8,9,8] },
    { hop:3, ip:null, ms:null, target:true }
  ]
};

// ── FAULT LIBRARY ─────────────────────────────────────────────────────────────
// Each fault: inject(config) mutates config and returns instanceState.
// validate(config, instanceState) returns true when the fault is fixed.
var FAULT_LIBRARY = [

  // ── LAYER 1 — Physical ────────────────────────────────────────────────────
  {
    id: 'iface-shutdown-wan',
    name: 'WAN Interface Shutdown',
    osiLayer: 1,
    difficulty: 1,
    subtle: false,
    description: 'GigabitEthernet0/1 (WAN uplink) is administratively shut down',
    hints: {
      easy: "Layer 1 — run 'show ip interface brief' and look for 'administratively down'",
      medium: 'Layer 1 issue'
    },
    fix: 'interface GigabitEthernet0/1  →  no shutdown',
    detection: "'show ip interface brief' shows GigabitEthernet0/1 administratively down",
    inject: function (config) {
      var iface = config.interfaces.find(function (i) { return /0\/1$/.test(i.name); });
      if (!iface) return {};
      iface.status = 'administratively down';
      iface.proto  = 'down';
      config.pingSuccess = false;
      config.tracePath   = null;
      return { ifaceName: iface.name };
    },
    validate: function (config, s) {
      var iface = config.interfaces.find(function (i) { return i.name === s.ifaceName; });
      return !!(iface && iface.proto === 'up');
    }
  },

  {
    id: 'iface-shutdown-lan',
    name: 'LAN Interface Shutdown',
    osiLayer: 1,
    difficulty: 1,
    subtle: false,
    description: 'GigabitEthernet0/0 (LAN) is administratively shut down',
    hints: {
      easy: "Layer 1 — run 'show ip interface brief' and look for 'administratively down'",
      medium: 'Layer 1 issue'
    },
    fix: 'interface GigabitEthernet0/0  →  no shutdown',
    detection: "'show ip interface brief' shows GigabitEthernet0/0 administratively down",
    inject: function (config) {
      var iface = config.interfaces.find(function (i) { return /0\/0$/.test(i.name); });
      if (!iface) return {};
      iface.status = 'administratively down';
      iface.proto  = 'down';
      config.pingSuccess = false;
      config.tracePath   = null;
      return { ifaceName: iface.name };
    },
    validate: function (config, s) {
      var iface = config.interfaces.find(function (i) { return i.name === s.ifaceName; });
      return !!(iface && iface.proto === 'up');
    }
  },

  // ── LAYER 2 — Data Link ───────────────────────────────────────────────────
  {
    id: 'vlan-mismatch-l2',
    name: 'VLAN Port Mismatch',
    osiLayer: 2,
    difficulty: 1,
    subtle: false,
    description: 'PC port Fa0/1 is assigned to VLAN 30 instead of VLAN 10 (STAFF)',
    hints: {
      easy: "Layer 2 — run 'show vlan brief' and check which VLAN Fa0/1 belongs to",
      medium: 'Layer 2 issue'
    },
    fix: 'interface FastEthernet0/1  →  switchport access vlan 10',
    detection: "'show vlan brief' shows Fa0/1 in VLAN 30, not VLAN 10",
    inject: function (config) {
      config.vlans = [
        { id:1,  name:'default',    status:'active', ports:'Gi0/2' },
        { id:10, name:'STAFF',      status:'active', ports:'Fa0/2' },
        { id:20, name:'MGMT',       status:'active', ports:'Gi0/0' },
        { id:30, name:'WRONG_VLAN', status:'active', ports:'Fa0/1' }
      ];
      config.vlanHint    = '! Fa0/1 is in VLAN 30 — expected VLAN 10 (STAFF)';
      config.pingSuccess = false;
      config.tracePath   = null;
      return { targetVlan: 10 };
    },
    validate: function (config, s) {
      if (!config.vlans) return false;
      var v = config.vlans.find(function (v) { return v.id === s.targetVlan; });
      return !!(v && v.ports && v.ports.includes('Fa0/1'));
    }
  },

  {
    id: 'native-vlan-mismatch',
    name: 'Native VLAN Mismatch',
    osiLayer: 2,
    difficulty: 2,
    subtle: true,
    description: 'Trunk native VLAN is 99 on this end but 1 on the far end — CDP reports mismatch',
    hints: {
      easy: "Layer 2 — run 'show vlan brief' and read the hint about native VLAN",
      medium: 'Layer 2 issue'
    },
    fix: 'interface GigabitEthernet0/0  →  switchport trunk native vlan 1',
    detection: "'show vlan brief' shows CDP native VLAN mismatch warning",
    inject: function (config) {
      config.vlans = [
        { id:1,  name:'default', status:'active', ports:'Gi0/2' },
        { id:10, name:'STAFF',   status:'active', ports:'Fa0/1, Fa0/2' },
        { id:20, name:'MGMT',    status:'active', ports:'Gi0/0' }
      ];
      config.vlanHint    = '! Native VLAN mismatch on trunk Gi0/0: local=99, remote=1. CDP: %CDP-4-NATIVE_VLAN_MISMATCH: Native VLAN mismatch on GigabitEthernet0/0';
      config.pingSuccess = false;
      config.tracePath   = null;
      return {};
    },
    validate: function (config) {
      return !(config.vlanHint && config.vlanHint.includes('mismatch'));
    }
  },

  // ── LAYER 3 — Network ─────────────────────────────────────────────────────
  {
    id: 'missing-default-route',
    name: 'Missing Default Route',
    osiLayer: 3,
    difficulty: 1,
    subtle: false,
    description: 'The default route (0.0.0.0/0) has been removed from the routing table',
    hints: {
      easy: "Layer 3 — run 'show ip route' and check for a default route (S* 0.0.0.0/0)",
      medium: 'Layer 3 issue'
    },
    fix: 'ip route 0.0.0.0 0.0.0.0 10.0.0.254',
    detection: "'show ip route' shows 'Gateway of last resort is not set'",
    inject: function (config) {
      config.routes = config.routes.filter(function (r) {
        return !r.includes('0.0.0.0/0') && !r.includes('Gateway of last resort');
      });
      config.routes.unshift('Gateway of last resort is not set');
      config.pingSuccess = false;
      config.tracePath   = null;
      return { nexthop: '10.0.0.254' };
    },
    validate: function (config) {
      return config.routes.some(function (r) { return r.includes('0.0.0.0/0'); });
    }
  },

  {
    id: 'wrong-next-hop',
    name: 'Wrong Default Route Next-Hop',
    osiLayer: 3,
    difficulty: 2,
    subtle: true,
    description: 'Default route exists but points to 10.0.0.99 (non-existent) instead of 10.0.0.254',
    hints: {
      easy: "Layer 3 — run 'traceroute 8.8.8.8' to see where packets die, then check 'show ip route'",
      medium: 'Layer 3 issue'
    },
    fix: 'no ip route 0.0.0.0 0.0.0.0 10.0.0.99  →  ip route 0.0.0.0 0.0.0.0 10.0.0.254',
    detection: "'show ip route' shows wrong next-hop; traceroute times out at hop 2",
    inject: function (config) {
      config.routes = config.routes.map(function (r) {
        if (r.includes('Gateway of last resort is')) return 'Gateway of last resort is 10.0.0.99 to network 0.0.0.0';
        if (r.includes('0.0.0.0/0'))                return 'S*   0.0.0.0/0 [1/0] via 10.0.0.99';
        return r;
      });
      config.pingSuccess = false;
      config.tracePath   = [
        { hop:1, ip:'10.0.0.99', ms:[2,2,3] },
        { hop:2, ip:null, ms:'timeout' },
        { hop:3, ip:null, ms:'timeout' }
      ];
      return { correctNexthop: '10.0.0.254', wrongNexthop: '10.0.0.99' };
    },
    validate: function (config, s) {
      return config.routes.some(function (r) {
        return r.includes('0.0.0.0/0') && r.includes(s.correctNexthop);
      });
    }
  },

  {
    id: 'wrong-ip-wan',
    name: 'Wrong WAN Interface IP',
    osiLayer: 3,
    difficulty: 2,
    subtle: true,
    description: 'GigabitEthernet0/1 has IP 10.0.0.2 instead of 10.0.0.1',
    hints: {
      easy: "Layer 3 — run 'show ip interface brief' and compare IPs to the topology diagram",
      medium: 'Layer 3 issue'
    },
    fix: 'interface GigabitEthernet0/1  →  ip address 10.0.0.1 255.255.255.0',
    detection: "'show ip interface brief' shows unexpected IP on Gi0/1",
    inject: function (config) {
      var iface = config.interfaces.find(function (i) { return /0\/1$/.test(i.name); });
      if (!iface) return {};
      var correctIp = iface.ip;
      iface.ip = '10.0.0.2';
      config.routes = config.routes.map(function (r) {
        return r.includes('L    10.0.0.1/32')
          ? 'L    10.0.0.2/32 is directly connected, GigabitEthernet0/1'
          : r;
      });
      config.pingSuccess = false;
      config.tracePath   = null;
      return { ifaceName: iface.name, correctIp: correctIp, wrongIp: '10.0.0.2' };
    },
    validate: function (config, s) {
      var iface = config.interfaces.find(function (i) { return i.name === s.ifaceName; });
      return !!(iface && iface.ip === s.correctIp);
    }
  },

  // ── LAYER 4 — Transport ───────────────────────────────────────────────────
  {
    id: 'acl-block-lan',
    name: 'ACL Blocking All LAN Traffic',
    osiLayer: 4,
    difficulty: 2,
    subtle: true,
    description: 'ACL 101 denies all IP traffic from 192.168.1.0/24 — interfaces are up but traffic is dropped',
    hints: {
      easy: "Layer 4 — run 'show access-lists' and look for deny rules with high hit counts",
      medium: 'Layer 4 issue'
    },
    fix: 'no access-list 101',
    detection: "'show access-lists' shows deny rule for 192.168.1.0/24 with high hit count",
    inject: function (config) {
      config.accessLists = [{
        num: 101,
        type: 'extended',
        rules: [
          { action:'deny',   proto:'ip', src:'192.168.1.0 0.0.0.255', dst:'any', hits: Math.floor(Math.random() * 200) + 80 },
          { action:'permit', proto:'ip', src:'any',                    dst:'any', hits: 0 }
        ],
        appliedTo: 'GigabitEthernet0/1 in'
      }];
      config.pingSuccess = false;
      config.tracePath   = null;
      return {};
    },
    validate: function (config) {
      if (!config.accessLists || !config.accessLists.length) return true;
      var acl = config.accessLists.find(function (a) { return a.num === 101; });
      if (!acl) return true;
      return !acl.rules.some(function (r) {
        return r.action === 'deny' && r.src && r.src.includes('192.168.1.0');
      });
    }
  },

  // ── LAYER 7 — Application ─────────────────────────────────────────────────
  {
    id: 'dhcp-wrong-gateway',
    name: 'DHCP Wrong Default Gateway',
    osiLayer: 7,
    difficulty: 1,
    subtle: false,
    description: 'DHCP pool distributes 192.168.1.254 as default gateway — clients cannot reach WAN',
    hints: {
      easy: "Layer 7 — run 'show ip dhcp pool' and check the default-router value",
      medium: 'Layer 7 issue'
    },
    fix: 'ip dhcp pool LAN-POOL  →  default-router 192.168.1.1',
    detection: "'show ip dhcp pool' shows wrong gateway (192.168.1.254 instead of 192.168.1.1)",
    inject: function (config) {
      config.dhcp = {
        pool: { name:'LAN-POOL', network:'192.168.1.0/24', gateway:'192.168.1.254',
                excluded:'192.168.1.1 - 192.168.1.9', total:245, leased:12, available:233 },
        bindings: [
          { ip:'192.168.1.10', mac:'0050.56c0.0001', expires:'Apr 19 2026 08:14', type:'Automatic' },
          { ip:'192.168.1.11', mac:'0050.56c0.0002', expires:'Apr 19 2026 08:15', type:'Automatic' }
        ]
      };
      return { correctGateway: '192.168.1.1' };
    },
    validate: function (config, s) {
      return !!(config.dhcp && config.dhcp.pool && config.dhcp.pool.gateway === s.correctGateway);
    }
  },

  {
    id: 'dhcp-exhausted',
    name: 'DHCP Excluded Range Too Large',
    osiLayer: 7,
    difficulty: 1,
    subtle: false,
    description: 'Excluded range covers the entire pool — no addresses available for new clients',
    hints: {
      easy: "Layer 7 — run 'show ip dhcp pool' and check how many addresses are available",
      medium: 'Layer 7 issue'
    },
    fix: 'no ip dhcp excluded-address 192.168.1.10 192.168.1.254',
    detection: "'show ip dhcp pool' shows 0 available addresses",
    inject: function (config) {
      config.dhcp = {
        pool: { name:'LAN-POOL', network:'192.168.1.0/24', gateway:'192.168.1.1',
                excluded:'192.168.1.1 - 192.168.1.254', total:253, leased:0, available:0 },
        bindings: []
      };
      return {};
    },
    validate: function (config) {
      return !!(config.dhcp && config.dhcp.pool && config.dhcp.pool.available > 0);
    }
  }

];

// ── GENERATOR STATE ───────────────────────────────────────────────────────────
var SGEN = {
  active:    false,
  difficulty: 1,
  faults:    [],     // [{...faultDef, instanceState:{}}]
  config:    null,   // live mutable copy — same ref as TERM_SCENARIOS['generated']
  startTime: null,
  cmdCount:  0,
  resolved:  [],     // fault IDs that have been validated as fixed
  timerInterval: null
};

// ── STATS ─────────────────────────────────────────────────────────────────────
function sgenDefaultStats() {
  return {
    attempted:   { 1:0, 2:0, 3:0, 4:0 },
    solved:      { 1:0, 2:0, 3:0, 4:0 },
    bestTime:    { 1:null, 2:null, 3:null, 4:null },
    streak:      0,
    bestStreak:  0,
    layersSolved: []
  };
}
function sgenLoadStats() {
  try { return JSON.parse(localStorage.getItem(SGEN_STATS_KEY)) || sgenDefaultStats(); }
  catch (e) { return sgenDefaultStats(); }
}
function sgenSaveStatsData(data) {
  try { localStorage.setItem(SGEN_STATS_KEY, JSON.stringify(data)); } catch (e) {}
}
function sgenRecordAttempt(diff) {
  var s = sgenLoadStats();
  s.attempted[diff] = (s.attempted[diff] || 0) + 1;
  sgenSaveStatsData(s);
}
function sgenRecordSolve(diff, timeMs, faults) {
  var s = sgenLoadStats();
  s.solved[diff] = (s.solved[diff] || 0) + 1;
  if (!s.bestTime[diff] || timeMs < s.bestTime[diff]) s.bestTime[diff] = timeMs;
  s.streak = (s.streak || 0) + 1;
  if (s.streak > (s.bestStreak || 0)) s.bestStreak = s.streak;
  if (!Array.isArray(s.layersSolved)) s.layersSolved = [];
  faults.forEach(function (f) {
    if (!s.layersSolved.includes(f.osiLayer)) s.layersSolved.push(f.osiLayer);
  });
  sgenSaveStatsData(s);
  return s;
}
function sgenRecordGiveUp() {
  var s = sgenLoadStats();
  s.streak = 0;
  sgenSaveStatsData(s);
}

// ── GENERATION ────────────────────────────────────────────────────────────────
function sgenDeepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function sgenPickFaults(difficulty) {
  var count = DIFF_FAULTS[difficulty];
  var pool  = (difficulty === 1)
    ? FAULT_LIBRARY.filter(function (f) { return f.difficulty === 1 && !f.subtle; })
    : FAULT_LIBRARY;

  // Shuffle
  var shuffled = pool.slice().sort(function () { return Math.random() - 0.5; });

  var picked     = [];
  var usedLayers = {};

  for (var i = 0; i < shuffled.length; i++) {
    if (picked.length >= count) break;
    var f = shuffled[i];
    if (count > 1 && usedLayers[f.osiLayer]) continue;
    picked.push(f);
    usedLayers[f.osiLayer] = true;
  }

  // Nightmare: ensure at least one subtle fault
  if (difficulty === 4 && !picked.some(function (f) { return f.subtle; })) {
    var sub = FAULT_LIBRARY.find(function (f) { return f.subtle && !usedLayers[f.osiLayer]; });
    if (sub) picked[picked.length - 1] = sub;
  }

  return picked.slice(0, count);
}

function sgenGenerate(difficulty, faultIds) {
  var defs = faultIds
    ? faultIds.map(function (id) {
        return FAULT_LIBRARY.find(function (f) { return f.id === id; });
      }).filter(Boolean)
    : sgenPickFaults(difficulty);
  var config = sgenDeepClone(HEALTHY_BASE);

  var faults = defs.map(function (def) {
    var instanceState = def.inject(config);
    return {
      id:            def.id,
      name:          def.name,
      osiLayer:      def.osiLayer,
      difficulty:    def.difficulty,
      subtle:        def.subtle,
      description:   def.description,
      hints:         def.hints,
      fix:           def.fix,
      detection:     def.detection,
      inject:        def.inject,
      validate:      def.validate,
      instanceState: instanceState
    };
  });

  return { config: config, faults: faults };
}

// ── CONFIG COMMAND STATE UPDATER ──────────────────────────────────────────────
// Called after termExec runs the stub. Updates SGEN.config so subsequent
// show commands and fault validators see the user's changes.
function sgenApplyConfigCmd(raw) {
  if (!SGEN.active || !SGEN.config) return;
  var trimmed = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  var config  = SGEN.config;

  // ── interface-level commands ──────────────────────────────────────────────
  if (TERM.mode === 'config-if' && TERM.currentIface) {
    var ifRaw = TERM.currentIface.toLowerCase();
    var iface = config.interfaces.find(function (i) {
      var n = i.name.toLowerCase();
      return n === ifRaw ||
             n.replace('gigabitethernet', 'gi').replace('fastethernet', 'fa') === ifRaw ||
             ifRaw.replace('gi', 'gigabitethernet').replace('fa', 'fastethernet') === n;
    });

    if (trimmed === 'no shutdown' && iface) {
      iface.status = 'up';
      iface.proto  = 'up';
      // Restore ping/trace if WAN + LAN both up and default route is healthy
      var wan = config.interfaces.find(function (i) { return /0\/1$/.test(i.name); });
      var lan = config.interfaces.find(function (i) { return /0\/0$/.test(i.name); });
      var defRouteMatch = config.routes.find(function (r) { return r.includes('0.0.0.0/0') && r.includes('via'); });
      var nexthop = defRouteMatch && defRouteMatch.match(/via\s+([\d.]+)/);
      if (wan && wan.proto === 'up' && lan && lan.proto === 'up'
          && nexthop && nexthop[1] === '10.0.0.254') {
        config.pingSuccess = true;
        config.tracePath = [
          { hop:1, ip:'10.0.0.254', ms:[1,1,2] },
          { hop:2, ip:'203.0.113.1', ms:[8,9,8] },
          { hop:3, ip:null, ms:null, target:true }
        ];
      }
    }

    if (trimmed === 'shutdown' && iface) {
      iface.status       = 'administratively down';
      iface.proto        = 'down';
      config.pingSuccess = false;
      config.tracePath   = null;
    }

    if (trimmed.indexOf('ip address ') === 0 && iface) {
      var parts = trimmed.split(' ');
      if (parts.length >= 3) {
        var newIp = parts[2];
        iface.ip  = newIp;
        // Update local route line
        config.routes = config.routes.map(function (r) {
          if (r.indexOf('L    10.0.0.') === 0 && r.includes(iface.name)) {
            return 'L    ' + newIp + '/32 is directly connected, ' + iface.name;
          }
          return r;
        });
        if (newIp === '10.0.0.1' && iface.proto === 'up') {
          config.pingSuccess = true;
          config.tracePath = [
            { hop:1, ip:'10.0.0.254', ms:[1,1,2] },
            { hop:2, ip:'203.0.113.1', ms:[8,9,8] },
            { hop:3, ip:null, ms:null, target:true }
          ];
        }
      }
    }

    if (trimmed.indexOf('switchport access vlan ') === 0 && config.vlans) {
      var vlanId = parseInt(trimmed.split(' ').pop(), 10);
      // Remove Fa0/1 from all VLANs
      config.vlans = config.vlans.map(function (v) {
        return Object.assign({}, v, {
          ports: (v.ports || '')
            .replace(/,\s*Fa0\/1/g, '').replace(/Fa0\/1,?\s*/g, '').trim()
        });
      });
      var targetV = config.vlans.find(function (v) { return v.id === vlanId; });
      if (targetV) {
        targetV.ports = targetV.ports ? targetV.ports + ', Fa0/1' : 'Fa0/1';
      } else {
        config.vlans.push({ id:vlanId, name:'VLAN'+vlanId, status:'active', ports:'Fa0/1' });
      }
      config.vlanHint = null;
      if (vlanId === 10) {
        config.pingSuccess = true;
        config.tracePath = [
          { hop:1, ip:'10.0.0.254', ms:[1,1,2] },
          { hop:2, ip:'203.0.113.1', ms:[8,9,8] },
          { hop:3, ip:null, ms:null, target:true }
        ];
      }
    }

    if (trimmed.indexOf('switchport trunk native vlan ') === 0) {
      config.vlanHint    = null;
      config.pingSuccess = true;
      config.tracePath   = [
        { hop:1, ip:'10.0.0.254', ms:[1,1,2] },
        { hop:2, ip:'203.0.113.1', ms:[8,9,8] },
        { hop:3, ip:null, ms:null, target:true }
      ];
    }
  }

  // ── global-config-level commands ──────────────────────────────────────────
  if (TERM.mode === 'config') {

    // ip route 0.0.0.0 0.0.0.0 <nexthop>
    var addMatch = trimmed.match(/^ip route 0\.0\.0\.0 0\.0\.0\.0 ([\d.]+)/);
    if (addMatch) {
      var nh = addMatch[1];
      config.routes = config.routes.filter(function (r) {
        return !r.includes('0.0.0.0/0') && !r.includes('Gateway of last resort');
      });
      config.routes.unshift('S*   0.0.0.0/0 [1/0] via ' + nh);
      config.routes.unshift('Gateway of last resort is ' + nh + ' to network 0.0.0.0');
      var wan2 = config.interfaces.find(function (i) { return /0\/1$/.test(i.name); });
      if (nh === '10.0.0.254' && wan2 && wan2.proto === 'up') {
        config.pingSuccess = true;
        config.tracePath = [
          { hop:1, ip:'10.0.0.254', ms:[1,1,2] },
          { hop:2, ip:'203.0.113.1', ms:[8,9,8] },
          { hop:3, ip:null, ms:null, target:true }
        ];
      } else {
        config.pingSuccess = false;
        config.tracePath = [
          { hop:1, ip:nh, ms:[2,2,3] },
          { hop:2, ip:null, ms:'timeout' },
          { hop:3, ip:null, ms:'timeout' }
        ];
      }
    }

    // no ip route 0.0.0.0 0.0.0.0 ...
    if (trimmed.indexOf('no ip route 0.0.0.0 0.0.0.0') === 0) {
      config.routes = config.routes.filter(function (r) {
        return !r.includes('0.0.0.0/0') && !r.includes('Gateway of last resort');
      });
      config.routes.unshift('Gateway of last resort is not set');
      config.pingSuccess = false;
      config.tracePath   = null;
    }

    // no access-list <n>
    var rmAcl = trimmed.match(/^no access-list (\d+)/);
    if (rmAcl && config.accessLists) {
      var aclNum = parseInt(rmAcl[1], 10);
      config.accessLists = config.accessLists.filter(function (a) { return a.num !== aclNum; });
      if (!config.accessLists.length) {
        config.pingSuccess = true;
        config.tracePath = [
          { hop:1, ip:'10.0.0.254', ms:[1,1,2] },
          { hop:2, ip:'203.0.113.1', ms:[8,9,8] },
          { hop:3, ip:null, ms:null, target:true }
        ];
      }
    }

    // default-router <ip>  (DHCP pool sub-mode — simplified: accept in config mode too)
    var dhcpGw = trimmed.match(/^default-router ([\d.]+)/);
    if (dhcpGw && config.dhcp && config.dhcp.pool) {
      config.dhcp.pool.gateway = dhcpGw[1];
    }

    // no ip dhcp excluded-address ...
    if (trimmed.indexOf('no ip dhcp excluded-address') === 0 && config.dhcp && config.dhcp.pool) {
      config.dhcp.pool.excluded  = '192.168.1.1 - 192.168.1.9';
      config.dhcp.pool.available = 233;
      config.dhcp.pool.total     = 245;
    }
  }

  // Re-render topology immediately so show commands reflect reality
  if (typeof termRenderTopology === 'function') termRenderTopology();
  if (typeof renderNetMap === 'function') renderNetMap();
}

// ── FAULT VALIDATION ──────────────────────────────────────────────────────────
function sgenCheckFaults() {
  if (!SGEN.active) return;
  var newResolved = [];
  var changed     = false;

  SGEN.faults.forEach(function (f) {
    var wasResolved = SGEN.resolved.includes(f.id);
    var isResolved  = f.validate(SGEN.config, f.instanceState);
    if (isResolved) newResolved.push(f.id);
    if (isResolved && !wasResolved) changed = true;
  });

  SGEN.resolved = newResolved;
  sgenUpdateCounter();

  if (changed && SGEN.resolved.length === SGEN.faults.length) {
    setTimeout(sgenVictory, 400);
  }
}

// ── TIMER ─────────────────────────────────────────────────────────────────────
function sgenStartTimer() {
  SGEN.startTime = Date.now();
  SGEN.timerInterval = setInterval(function () {
    var secs = Math.floor((Date.now() - SGEN.startTime) / 1000);
    var m    = String(Math.floor(secs / 60)).padStart(2, '0');
    var s    = String(secs % 60).padStart(2, '0');
    var el   = document.getElementById('sgenTimer');
    if (el) el.textContent = m + ':' + s;
  }, 1000);
}
function sgenStopTimer() {
  if (SGEN.timerInterval) { clearInterval(SGEN.timerInterval); SGEN.timerInterval = null; }
}
function sgenElapsed() { return SGEN.startTime ? Date.now() - SGEN.startTime : 0; }

// ── UI HELPERS ────────────────────────────────────────────────────────────────
function sgenUpdateCounter() {
  var el = document.getElementById('sgenFound');
  if (el) el.textContent = SGEN.resolved.length + '/' + SGEN.faults.length;
}

function sgenShowSelector() {
  var sel  = document.getElementById('sgenSelector');
  var bar  = document.getElementById('sgenActiveBar');
  var hint = document.getElementById('sgenHintBar');
  if (sel)  sel.style.display  = '';
  if (bar)  bar.style.display  = 'none';
  if (hint) { hint.style.display = 'none'; hint.textContent = ''; }
}

function sgenShowActiveBar(difficulty, faultCount) {
  var sel = document.getElementById('sgenSelector');
  var bar = document.getElementById('sgenActiveBar');
  if (sel) sel.style.display = 'none';
  if (bar) bar.style.display = '';
  var lbl = document.getElementById('sgenDiffLabel');
  if (lbl) lbl.textContent = DIFF_NAMES[difficulty] + ' (' + faultCount + ' fault' + (faultCount > 1 ? 's' : '') + ')';
  sgenUpdateCounter();
}

function sgenShowHint(hintText) {
  var bar = document.getElementById('sgenHintBar');
  if (!bar) return;
  if (hintText) {
    bar.style.display = '';
    bar.textContent   = '// Hint: ' + hintText;
  } else {
    bar.style.display = 'none';
  }
}

// ── MAIN ACTIONS ──────────────────────────────────────────────────────────────
window.sgenStart = function (difficulty, faultIds) {
  sgenStopTimer();

  var result = sgenGenerate(difficulty, faultIds || null);
  SGEN.active     = true;
  SGEN.difficulty = difficulty;
  SGEN.faults     = result.faults;
  SGEN.config     = result.config;
  SGEN.cmdCount   = 0;
  SGEN.resolved   = [];

  // Register as a terminal scenario
  TERM_SCENARIOS['generated'] = SGEN.config;

  // Build briefing HTML
  var layerNums = [];
  result.faults.forEach(function (f) {
    if (!layerNums.includes(f.osiLayer)) layerNums.push(f.osiLayer);
  });
  layerNums.sort();
  var color    = DIFF_COLORS[difficulty];
  var fCount   = result.faults.length;
  SGEN.config.briefing = [
    '<div style="display:flex;align-items:center;gap:.7rem;margin-bottom:.55rem;flex-wrap:wrap">',
    '  <div class="term-category-badge" style="--cat-color:' + color + '">',
    '    <span class="tcb-cat">⚡ GENERATED</span>',
    '    <span class="tcb-sep"> · </span>',
    '    <span class="tcb-scen">' + DIFF_NAMES[difficulty] + ' — ' + fCount + ' fault' + (fCount > 1 ? 's' : '') + '</span>',
    '  </div>',
    '</div>',
    '<b>Find and fix the fault' + (fCount > 1 ? 's' : '') + '.</b> ',
    'Use <code>show</code> commands to diagnose, then enter config mode to fix.<br>',
    'Layers involved: ' + layerNums.map(function (n) { return 'L' + n; }).join(', '),
    ' — start with <b>enable</b> → <b>show ip interface brief</b>.'
  ].join('');
  SGEN.config.layers = [];

  // Disable the scenario select while generator is active
  var termSel = document.getElementById('termScenario');
  if (termSel) {
    termSel.disabled = true;
    // Set to hidden generated option so termChangeScenario reads correct label
    var genOpt = document.getElementById('sgenGenOption');
    if (genOpt) termSel.value = 'generated';
  }

  if (typeof termChangeScenario === 'function') termChangeScenario('generated');

  // Override the generic load message with a custom one
  var screen = document.getElementById('termScreen');
  if (screen) {
    screen.innerHTML = '';
    if (typeof termPrint === 'function') {
      termPrint('% ⚡ GENERATED SCENARIO LOADED — ' + DIFF_NAMES[difficulty].toUpperCase(), 'dim');
      termPrint('% ' + fCount + ' fault' + (fCount > 1 ? 's' : '') + ' injected. Use diagnostic commands to find them.', 'dim');
      termPrint('Type "?" for available commands. Use "enable" for privileged mode.', 'dim');
      termPrint('');
    }
  }

  sgenShowActiveBar(difficulty, fCount);

  // Hints for Easy and Medium
  if (difficulty <= 2) {
    var hintKey = difficulty === 1 ? 'easy' : 'medium';
    var hints   = result.faults.map(function (f) { return f.hints[hintKey]; }).filter(Boolean);
    if (hints.length) sgenShowHint(hints.join(' | '));
  }

  sgenStartTimer();
  sgenRecordAttempt(difficulty);

  if (typeof showPage === 'function') showPage('terminal');
};

window.sgenNew = function () {
  sgenStopTimer();
  var d = SGEN.difficulty;
  SGEN.active = false;
  var termSel = document.getElementById('termScenario');
  if (termSel) termSel.disabled = false;
  window.sgenStart(d);
};

window.sgenShareScenario = function () {
  if (!SGEN.active || !SGEN.faults.length) return;
  var payload = JSON.stringify({ d: SGEN.difficulty, f: SGEN.faults.map(function (f) { return f.id; }) });
  var encoded = btoa(payload);
  var url = location.origin + location.pathname + '#sgen=' + encoded;
  var elapsed = sgenElapsed();
  var m = String(Math.floor(Math.floor(elapsed / 1000) / 60)).padStart(2, '0');
  var s = String(Math.floor(elapsed / 1000) % 60).padStart(2, '0');
  var text = 'cisco:learn — hjelp meg! 🔧\n' +
    DIFF_NAMES[SGEN.difficulty] + ' | ' + SGEN.faults.length +
    ' fault' + (SGEN.faults.length !== 1 ? 's' : '') +
    ' | ' + m + ':' + s + ' elapsed\n' + url;
  if (typeof shareResult === 'function') shareResult(text);
};

function sgenCheckHash() {
  var match = location.hash.match(/^#sgen=([A-Za-z0-9+/=]+)$/);
  if (!match) return;
  try {
    var payload = JSON.parse(atob(match[1]));
    if (!payload.d || !Array.isArray(payload.f) || !payload.f.length) return;
    history.replaceState(null, '', location.pathname + location.search);
    setTimeout(function () {
      if (typeof showPage === 'function') showPage('terminal');
      window.sgenStart(payload.d, payload.f);
    }, 150);
  } catch (e) {}
}

window.sgenExit = function () {
  sgenStopTimer();
  SGEN.active = false;
  var termSel = document.getElementById('termScenario');
  if (termSel) { termSel.disabled = false; termSel.value = 'all-up'; }
  sgenShowSelector();
  if (typeof termChangeScenario === 'function') termChangeScenario('all-up');
};

// Give Up with double-tap confirmation
var _sgenGiveUpTimer = null;
window.sgenGiveUp = function () {
  var btn = document.getElementById('sgenGiveUpBtn');
  if (!btn) return;
  if (btn._confirming) {
    clearTimeout(_sgenGiveUpTimer);
    btn._confirming = false;
    btn.textContent = 'Give Up';
    sgenReveal();
    return;
  }
  btn._confirming = true;
  btn.textContent  = 'Confirm?';
  _sgenGiveUpTimer = setTimeout(function () {
    if (btn) { btn._confirming = false; btn.textContent = 'Give Up'; }
  }, 3000);
};

function sgenReveal() {
  sgenStopTimer();
  SGEN.active = false;
  sgenRecordGiveUp();
  var termSel = document.getElementById('termScenario');
  if (termSel) termSel.disabled = false;

  var faultRows = SGEN.faults.map(function (f, i) {
    return [
      '<div class="sgen-reveal-fault">',
      '  <div class="sgen-reveal-num">' + (i + 1) + '.</div>',
      '  <div>',
      '    <div class="sgen-reveal-name">Layer ' + f.osiLayer + ' — ' + f.name + '</div>',
      '    <div class="sgen-reveal-item"><span class="sgen-reveal-lbl">Fault:</span> ' + f.description + '</div>',
      '    <div class="sgen-reveal-item"><span class="sgen-reveal-lbl">Fix:</span> <code>' + f.fix + '</code></div>',
      '    <div class="sgen-reveal-item"><span class="sgen-reveal-lbl">Detection:</span> ' + f.detection + '</div>',
      '  </div>',
      '</div>'
    ].join('');
  }).join('');

  var nextDiff = Math.min(SGEN.difficulty + 1, 4);
  sgenShowOverlay([
    '<div class="sgen-result-icon" style="color:var(--red)">✗</div>',
    '<div class="sgen-result-title" style="color:var(--red)">FAULTS REVEALED</div>',
    '<div class="sgen-reveal-list">' + faultRows + '</div>',
    '<div class="sgen-result-btns">',
    '  <button class="sgen-result-btn" onclick="sgenNew();sgenCloseOverlay()">Try Again</button>',
    '  <button class="sgen-result-btn" onclick="sgenCloseOverlay();sgenStart(' + nextDiff + ')">Harder →</button>',
    '  <button class="sgen-result-btn sgen-result-btn-ghost" onclick="sgenCloseOverlay();sgenExit()">Back to Menu</button>',
    '</div>',
    '<p class="sgen-overlay-dismiss">tap anywhere to dismiss</p>'
  ].join(''));
}

function sgenVictory() {
  sgenStopTimer();
  var elapsed     = sgenElapsed();
  var elapsedSecs = Math.floor(elapsed / 1000);
  var m     = String(Math.floor(elapsedSecs / 60)).padStart(2, '0');
  var s     = String(elapsedSecs % 60).padStart(2, '0');
  var stars = elapsedSecs < 300 ? 3 : elapsedSecs < 600 ? 2 : 1;
  var starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);

  var stats = sgenRecordSolve(SGEN.difficulty, elapsed, SGEN.faults);

  // Achievements
  if (typeof achUnlock === 'function') {
    var totalSolved = Object.values(stats.solved).reduce(function (a, b) { return a + b; }, 0);
    if (totalSolved === 1)                                             achUnlock('sgen_first');
    if (SGEN.difficulty === 1 && elapsedSecs < 60)                   achUnlock('sgen_speed');
    if (SGEN.difficulty === 4)                                        achUnlock('sgen_nightmare');
    if ((stats.streak || 0) >= 5)                                     achUnlock('sgen_streak5');
    if (stats.layersSolved && [1,2,3,4,7].every(function (l) {
      return stats.layersSolved.includes(l);
    }))                                                               achUnlock('sgen_layers');
  }

  if (typeof termPrint === 'function') {
    termPrint('');
    termPrint('% ALL FAULTS RESOLVED — well done!', 'ok');
    termPrint('% Time: ' + m + ':' + s + '  |  Commands: ' + SGEN.cmdCount + '  |  Rating: ' + starStr, 'ok');
    termPrint('');
  }

  SGEN.active = false;
  var termSel = document.getElementById('termScenario');
  if (termSel) termSel.disabled = false;

  var nextDiff2 = Math.min(SGEN.difficulty + 1, 4);
  var diffNames = ['', 'Easy', 'Medium', 'Hard', 'Nightmare'];
  var shareText = 'cisco:learn — Scenario Generator\n' +
    diffNames[SGEN.difficulty] + ' | ' + starStr + ' | ' + m + ':' + s + '\n' +
    SGEN.faults.length + ' fault' + (SGEN.faults.length !== 1 ? 's' : '') + ' resolved in ' +
    SGEN.cmdCount + ' command' + (SGEN.cmdCount !== 1 ? 's' : '') + ' 🔧\nciscolearn.schjoldr.io';
  sgenShowOverlay([
    '<div class="sgen-result-icon" style="color:var(--accent)">✓</div>',
    '<div class="sgen-result-title" style="color:var(--accent)">ALL FAULTS RESOLVED</div>',
    '<div class="sgen-result-stats">',
    '  <div class="sgen-stat-row"><span>Time</span><b>' + m + ':' + s + '</b></div>',
    '  <div class="sgen-stat-row"><span>Commands</span><b>' + SGEN.cmdCount + '</b></div>',
    '  <div class="sgen-stat-row"><span>Faults</span><b>' + SGEN.faults.length + '/' + SGEN.faults.length + '</b></div>',
    '  <div class="sgen-stat-row"><span>Rating</span><b class="sgen-stars">' + starStr + '</b></div>',
    '</div>',
    '<div class="sgen-result-btns">',
    '  <button class="sgen-result-btn" onclick="sgenNew();sgenCloseOverlay()">Try Again</button>',
    '  <button class="sgen-result-btn" onclick="sgenCloseOverlay();sgenStart(' + nextDiff2 + ')">Harder →</button>',
    '  <button class="sgen-result-btn sgen-result-btn-ghost" onclick="shareResult(' + JSON.stringify(shareText) + ')">Share</button>',
    '  <button class="sgen-result-btn sgen-result-btn-ghost" onclick="sgenCloseOverlay();sgenShowSelector()">Back to Menu</button>',
    '</div>',
    '<p class="sgen-overlay-dismiss">tap anywhere to dismiss</p>'
  ].join(''));
}

function sgenShowOverlay(html) {
  var overlay = document.getElementById('sgenOverlay');
  var box     = document.getElementById('sgenOverlayBox');
  if (overlay && box) { box.innerHTML = html; overlay.style.display = 'flex'; }
}
window.sgenCloseOverlay = function () {
  var el = document.getElementById('sgenOverlay');
  if (el) el.style.display = 'none';
};
window.sgenOverlayClose = function (e) {
  if (e.target && e.target.id === 'sgenOverlay') window.sgenCloseOverlay();
};
window.sgenShowSelector = sgenShowSelector;

// ── TERMINAL INTEGRATION ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  // Use setTimeout(0) so our wrapper runs after the main script's DOMContentLoaded
  // (which sets up the keydown handler that calls termExec by name).
  setTimeout(function () {
    var origExec = termExec; // function declaration — on window
    if (typeof origExec !== 'function') return;

    // Replace the global so the keydown handler picks up the wrapper at call time
    window.termExec = async function sgenTermExec(raw) {
      if (SGEN.active) SGEN.cmdCount++;

      await origExec(raw);

      if (SGEN.active) {
        // Apply config changes to the live scenario object
        if (TERM.mode === 'config' || TERM.mode === 'config-if') {
          sgenApplyConfigCmd(raw);
        }
        sgenCheckFaults();
      }
    };

    // Show the selector panel on page load
    sgenShowSelector();

    // Load shared scenario from URL hash if present
    sgenCheckHash();
  }, 0);
});

// ── ACHIEVEMENTS ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  setTimeout(function () {
    if (typeof ACHIEVEMENTS === 'undefined' || !Array.isArray(ACHIEVEMENTS)) return;
    var newAchs = [
      { id:'sgen_first',     icon:'⚡', name:'First Blood',    desc:'Solve your first generated scenario' },
      { id:'sgen_speed',     icon:'💨', name:'Speed Demon',   desc:'Solve Easy in under 60 seconds' },
      { id:'sgen_nightmare', icon:'💀', name:'Nightmare Fuel', desc:'Solve a Nightmare scenario' },
      { id:'sgen_streak5',   icon:'🔥', name:'Streak 5',       desc:'Solve 5 scenarios in a row without giving up' },
      { id:'sgen_layers',    icon:'🔬', name:'Layer Hunter',   desc:'Find faults on every major OSI layer (1,2,3,4,7)' }
    ];
    newAchs.forEach(function (a) {
      if (!ACHIEVEMENTS.find(function (e) { return e.id === a.id; })) ACHIEVEMENTS.push(a);
    });
    if (typeof renderAchGallery === 'function') renderAchGallery();
  }, 0);
});

})(); // end IIFE
