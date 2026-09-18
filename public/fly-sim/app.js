/* ============================================================
   FLY SIMULATOR — neural core
   A toy spiking motor circuit inspired by the MaleCNS v1.0
   fruit-fly connectome (166,700 neurons). This page runs 218
   simulated neurons: proprioceptive sensory input, a half-center
   CPG rhythm generator, a reservoir, motor pools, and dopamine
   neurons that gate reward-modulated plasticity.

   The 3D fly's arms are DRIVEN by motor-neuron firing rates —
   not keyframed. Dopamine stimulation on good reps rewires the
   circuit, so his form genuinely improves with training.
   ============================================================ */

// __NEURAL_CORE_START__
function __createFlyBrainCore() {
  'use strict';

  // ---------- deterministic RNG ----------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- network layout ----------
  // pools: SENS(40) CPG(4) INT(120) MOTOR(48) DA(6)
  const N_SENS = 40, N_CPG = 4, N_INT = 120, N_MOT = 48, N_DA = 6;
  const N = N_SENS + N_CPG + N_INT + N_MOT + N_DA;
  const O_SENS = 0, O_CPG = N_SENS, O_INT = O_CPG + N_CPG,
        O_MOT = O_INT + N_INT, O_DA = O_MOT + N_MOT;

  // motor pool indices: per arm 0=L 1=R; per dir 0=ADDUCT(close) 1=ABDUCT(open); 12 neurons each
  function motIdx(arm, dir, k) { return O_MOT + (arm * 2 + dir) * 12 + k; }
  // CPG: 0,1 = flexor half-center pair ; 2,3 = extensor half-center pair
  const CPG_FLEX = [O_CPG, O_CPG + 1], CPG_EXT = [O_CPG + 2, O_CPG + 3];

  const DT = 0.001;            // 1 ms sim step
  const TAU_M = 0.020;         // membrane time constant (s)
  const V_TH = 1.0, V_RESET = 0.0;
  const T_REF = 0.002;         // refractory (s)

  function createBrain(seed) {
    const rand = mulberry32(seed);

    const v = new Float32Array(N);
    const adapt = new Float32Array(N);   // spike-frequency adaptation (CPG only)
    const refr = new Float32Array(N);
    const iext = new Float32Array(N);
    const gsyn = new Float32Array(N);    // exponential synaptic conductance
    const spiked = new Uint8Array(N);
    const TAU_SYN = 0.005;              // 5 ms synaptic decay

    // synapses: pre, post, w, w0, plastic, e (eligibility)
    const pre = [], post = [], w = [], w0 = [], plast = [], elig = [];
    function addSyn(a, b, weight, plastic) {
      pre.push(a); post.push(b); w.push(weight); w0.push(weight);
      plast.push(plastic ? 1 : 0); elig.push(0);
    }
    const NS = () => pre.length;

    // ---- CPG: half-center oscillator (flex pair vs ext pair) ----
    // The two pairs inhibit each other; strong spike-frequency adaptation
    // makes the active pair tire out, letting the other pair escape.
    // Result: slow alternating bursts (~0.5-1 Hz) — the "open/close" rhythm.
    // Within a pair the two neurons share input and fire together.
    const W_INH = -4.0;
    for (const f of CPG_FLEX) for (const e of CPG_EXT) { addSyn(f, e, W_INH, false); addSyn(e, f, W_INH, false); }

    // ---- INT reservoir ----
    for (let i = 0; i < N_INT; i++) {
      const tgt = O_INT + i;
      for (let j = 0; j < N_INT; j++) {
        if (i !== j && rand() < 0.12) {
          addSyn(O_INT + j, tgt, (rand() * 2 - 1) * 0.9, false);
        }
      }
      if (rand() < 0.4) { // CPG drive into reservoir
        const c = O_CPG + Math.floor(rand() * N_CPG);
        addSyn(c, tgt, 5.0 + rand() * 2.0, false);
      }
      if (rand() < 0.15) { // sensory into reservoir
        addSyn(Math.floor(rand() * N_SENS), tgt, (rand() * 2 - 1) * 1.2, false);
      }
    }

    // ---- MOTOR pools ----
    const motW = []; // track plastic synapse indices feeding motor
    // per-arm "talent": one side starts weaker; dopamine training evens it out
    const armGain = [0.85 + rand() * 0.35, 0.85 + rand() * 0.35];
    for (let arm = 0; arm < 2; arm++) {
      for (let k = 0; k < 12; k++) {
        const add = motIdx(arm, 0, k), abd = motIdx(arm, 1, k);
        // innate correct-sign CPG drive (plastic): flex->ADDUCT, ext->ABDUCT
        // dopamine training strengthens these and prunes the cross-terms
        // innate correct-sign CPG drive:
        //  - fixed "spinal reflex" component (1.2, non-plastic): guarantees the
        //    fly can always move, so training never dies from a bad init
        //  - plastic component: dopamine/RPE-grown with training -> deeper ROM
        for (const f of CPG_FLEX) {
          addSyn(f, add, 1.2, false);
          addSyn(f, add, (1.0 + rand() * 0.5) * armGain[arm], true); motW.push(NS() - 1);
        }
        for (const e of CPG_EXT) {
          addSyn(e, abd, 1.2, false);
          addSyn(e, abd, (1.0 + rand() * 0.5) * armGain[arm], true); motW.push(NS() - 1);
        }
        // cross terms (plastic): start noticeable so early form is sloppy;
        // reward-prediction-error plasticity prunes them when they hurt reps
        for (const f of CPG_FLEX) { addSyn(f, abd, 0.5 + rand() * 0.4, true); motW.push(NS() - 1); }
        for (const e of CPG_EXT) { addSyn(e, add, 0.5 + rand() * 0.4, true); motW.push(NS() - 1); }
        // proprioceptive feedback (plastic)
        for (let s = 0; s < 3; s++) {
          const sn = Math.floor(rand() * N_SENS);
          addSyn(sn, add, rand() * 0.5, true); motW.push(NS() - 1);
          addSyn(sn, abd, rand() * 0.5, true); motW.push(NS() - 1);
        }
        // reservoir -> motor (plastic)
        for (let s = 0; s < 6; s++) {
          const rn = O_INT + Math.floor(rand() * N_INT);
          addSyn(rn, add, (rand() * 2 - 1) * 0.7, true); motW.push(NS() - 1);
          addSyn(rn, abd, (rand() * 2 - 1) * 0.7, true); motW.push(NS() - 1);
        }
        // efference copy motor -> reservoir (fixed)
        if (rand() < 0.5) addSyn(add, O_INT + Math.floor(rand() * N_INT), 0.8, false);
      }
    }

    const nSyn = NS();
    const preA = new Int32Array(pre), postA = new Int32Array(post);
    const wA = new Float32Array(w), w0A = new Float32Array(w0);
    const plastA = new Uint8Array(plast), eligA = new Float32Array(elig);

    // ---- state ----
    const S = {
      t: 0,
      // arm plant: s = spread (0.12 closed .. 1.5 wide), per arm
      s: [0.9, 0.9], sv: [0, 0],
      rates: new Float32Array(4), // [L_add,L_abd,R_add,R_abd] Hz
      daRate: 0,
      reps: 0, sets: 0,
      repScores: [],
      lastScore: 0,
      daEvents: 0,
      stimUntil: -1,
      armed: false,               // rep-cycle state machine
      repTrace: [],               // [sL, sR] samples during current rep
      wDelta: 0,                 // mean |w - w0| over plastic syns (learning meter)
      phaseFlex: 0,              // for HUD
      scoreAvg: 0.55,             // running average rep score (reward baseline)
      rpe: 0,                    // reward prediction error (decays after each DA pulse)
    };

    // sensory tuning: 20 per arm, preferred spread angles
    const sensPref = new Float32Array(N_SENS);
    for (let i = 0; i < N_SENS; i++) sensPref[i] = 0.12 + (1.5 - 0.12) * (i % 20) / 19;

    const TAU_E = 0.5;     // eligibility trace (s)
    const RPE_ETA = 1.5;     // reward-prediction-error plasticity gain
    const WMAX = 6.0;
    const TAU_H = 120;     // homeostatic drift back to w0 (s)

    function stimulate(mag, score) { // dopamine burst, mag 0..1, score = rep quality
      S.stimUntil = S.t + 0.15;
      S.stimMag = mag;
      S.daEvents++;
      // reward prediction error: better/worse than recent average?
      // (baseline adapts slowly so sustained improvement keeps paying off)
      S.rpe = score - S.scoreAvg;
      S.scoreAvg += (score - S.scoreAvg) / 200;
    }

    function step() {
      // --- external currents ---
      iext.fill(0);
      // tonic drive to CPG (flex pair gets a hair more so it wins the first burst)
      iext[CPG_FLEX[0]] = 2.2; iext[CPG_FLEX[1]] = 2.2;
      iext[CPG_EXT[0]] = 2.05; iext[CPG_EXT[1]] = 2.05;
      // proprioceptive sensory: gaussian tuning over each arm's spread
      for (let i = 0; i < N_SENS; i++) {
        const arm = i < 20 ? 0 : 1;
        const d = (S.s[arm] - sensPref[i]) / 0.35;
        iext[i] = 2.2 * Math.exp(-d * d);
      }
      // dopamine stimulation window
      const daOn = S.t < S.stimUntil;
      if (daOn) for (let i = 0; i < N_DA; i++) iext[O_DA + i] = 3.0 * (0.4 + 0.6 * (S.stimMag || 0.5));

      // --- synaptic input (exponential synapses) ---
      const gDecay = Math.exp(-DT / TAU_SYN);
      for (let i = 0; i < N; i++) gsyn[i] *= gDecay;
      for (let sxi = 0; sxi < nSyn; sxi++) {
        if (spiked[preA[sxi]]) gsyn[postA[sxi]] += wA[sxi];
      }
      const I = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const isCPG = i >= O_CPG && i < O_CPG + N_CPG;
        I[i] = iext[i] + gsyn[i] + (rand() - 0.5) * (isCPG ? 0.6 : 0.3);
      }

      // --- neuron update ---
      spiked.fill(0);
      for (let i = 0; i < N; i++) {
        if (refr[i] > 0) { refr[i] -= DT; v[i] = V_RESET; continue; }
        const isCPG = i >= O_CPG && i < O_CPG + N_CPG;
        const aTerm = isCPG ? 3.0 * adapt[i] : 0;
        v[i] += (DT / TAU_M) * (-(v[i]) + I[i] - aTerm);
        if (isCPG) adapt[i] *= Math.exp(-DT / 3.0);
        if (v[i] >= V_TH) {
          v[i] = V_RESET; refr[i] = T_REF; spiked[i] = 1;
          if (isCPG) adapt[i] += 0.008;
        }
      }

      // --- eligibility + reward-prediction-error plasticity ---
      // dopamine signal: EMA of DA spikes -> 0..1
      let daSpk = 0;
      for (let i = 0; i < N_DA; i++) daSpk += spiked[O_DA + i];
      S.daRate += ((daSpk / N_DA / DT) - S.daRate) * (DT / 0.06);
      const daSig = Math.min(1, S.daRate / 120);
      S.rpe *= Math.exp(-DT / 0.5); // reward signal fades after each DA pulse

      const eDecay = Math.exp(-DT / TAU_E);
      for (let sxi = 0; sxi < nSyn; sxi++) {
        if (!plastA[sxi]) continue;
        const a = preA[sxi], b = postA[sxi];
        if (spiked[a] && spiked[b]) eligA[sxi] = 1;
        else eligA[sxi] *= eDecay;
        // REINFORCE-style update: active pathways grow when the rep beats
        // expectations (rpe>0) and shrink when it disappoints (rpe<0).
        // This prunes cross-talk and wrong-sign drive instead of amplifying it.
        if (S.rpe > 0.004 || S.rpe < -0.004) {
          wA[sxi] += RPE_ETA * S.rpe * eligA[sxi] * DT;
          if (wA[sxi] > WMAX) wA[sxi] = WMAX;
          if (wA[sxi] < 0) wA[sxi] = 0;
        }
        // slow homeostasis toward initial weights
        wA[sxi] += (w0A[sxi] - wA[sxi]) * (DT / TAU_H);
      }

      // --- motor rates (EMA, Hz) ---
      const rDecay = Math.exp(-DT / 0.06);
      for (let arm = 0; arm < 2; arm++) for (let d = 0; d < 2; d++) {
        let c = 0;
        for (let k = 0; k < 12; k++) c += spiked[motIdx(arm, d, k)];
        const idx = arm * 2 + d;
        S.rates[idx] = S.rates[idx] * rDecay + (c / 12 / DT) * (1 - rDecay);
      }

      // --- arm plant: first-order servo driven by motor rate difference ---
      for (let arm = 0; arm < 2; arm++) {
        const drive = 0.08 * (S.rates[arm * 2] - S.rates[arm * 2 + 1]);
        const dDrive = drive > 2.5 ? 2.5 : drive < -2.5 ? -2.5 : drive;
        S.sv[arm] = dDrive - 1.8 * (S.s[arm] - 0.8);
        S.s[arm] += S.sv[arm] * DT;
        if (S.s[arm] < 0.12) { S.s[arm] = 0.12; }
        if (S.s[arm] > 1.5) { S.s[arm] = 1.5; }
      }

      // --- rep detection + scoring + phase-locked dopamine reward ---
      // A rep = one full open->close->open cycle. Dopamine is delivered at
      // BOTH phase transitions, each pulse rewarding the motor pathway that
      // is ACTIVE at that moment (eligibility traces give clean credit):
      //   - sAvg falls through 0.9: closing (flex/adduct) pathway rewarded
      //   - sAvg rises through 0.9: opening (ext/abduct) pathway rewarded,
      //     rep scored from the full-cycle trace
      const sAvg = (S.s[0] + S.s[1]) / 2;
      const prevAvg = S.prevAvg === undefined ? sAvg : S.prevAvg;
      if (!S.armed && sAvg > 1.0) { S.armed = true; S.repTrace.length = 0; S.daCloseDone = false; }
      if (S.armed) {
        if (S.traceTick === undefined) S.traceTick = 0;
        if (++S.traceTick % 5 === 0) S.repTrace.push(S.s[0], S.s[1]);
        if (S.repTrace.length > 1600) S.repTrace.splice(0, 2);
        // closing transition: reward the squeeze while adductors fire
        if (!S.daCloseDone && prevAvg >= 0.9 && sAvg < 0.9) {
          S.daCloseDone = true;
          const sc = S.runAvg || 0.5;
          stimulate(0.25 + 0.75 * sc, sc);
        }
        // opening transition: full cycle complete -> score + reward the stretch
        if (S.daCloseDone && prevAvg <= 0.9 && sAvg > 0.9) {
          S.armed = false; S.daCloseDone = false;
          S.reps++;
          const tr = S.repTrace; const n = tr.length / 2;
          let mn = 9, mx = -9, sym = 0, jerk = 0, prevV = 0;
          for (let i = 0; i < n; i++) {
            const sl = tr[2 * i], sr = tr[2 * i + 1];
            const a = (sl + sr) / 2;
            if (a < mn) mn = a; if (a > mx) mx = a;
            sym += Math.abs(sl - sr);
            if (i > 0) { const vv = a - (tr[2 * (i - 1)] + tr[2 * (i - 1) + 1]) / 2; jerk += Math.abs(vv - prevV); prevV = vv; }
          }
          const rom = Math.min(1, (mx - mn) / 1.1);
          const symS = Math.max(0, 1 - (sym / n) / 0.5);
          const smoS = Math.max(0, 1 - (jerk / Math.max(1, n)) / 0.02);
          const score = 0.45 * rom + 0.35 * symS + 0.2 * smoS;
          S.lastScore = score;
          S.lastComp = { rom, symS, smoS };
          S.repScores.push(score);
          if (S.repScores.length > 40) S.repScores.shift();
          S.runAvg = S.repScores.reduce((x, y) => x + y, 0) / S.repScores.length;
          if (S.reps % 10 === 0) S.sets++;
          stimulate(0.25 + 0.75 * score, score); // dopamine reward for the rep
        }
      }
      S.prevAvg = sAvg;

      S.t += DT;
    }

    function meanWDelta() {
      let d = 0;
      for (const i of motW) d += Math.abs(wA[i] - w0A[i]);
      return d / motW.length;
    }

    function spikeSnapshot() { // for raster + hologram: copy of spiked flags
      return Uint8Array.from(spiked);
    }

    function reset(seed2) {
      const fresh = createBrain(seed2 === undefined ? (Math.random() * 1e9) | 0 : seed2);
      // copy fresh state over (keeps object identity for the renderer)
      for (const k of Object.keys(fresh.S)) {
        if (k === 't') continue;
        S[k] = fresh.S[k];
      }
      v.set(fresh._v); adapt.set(fresh._adapt); refr.set(fresh._refr);
      gsyn.fill(0); iext.fill(0); spiked.fill(0);
      wA.set(fresh._wA); eligA.fill(0);
      S.wDelta = 0; S.t = 0; S.traceTick = 0;
    }

    return {
      S, step, stimulate, reset, spikeSnapshot, meanWDelta,
      info: { N, N_SENS, N_CPG, N_INT, N_MOT, N_DA, O_SENS, O_CPG, O_INT, O_MOT, O_DA },
      _v: v, _adapt: adapt, _refr: refr, _wA: wA,
      poolOf(i) {
        if (i < O_CPG) return 0; if (i < O_INT) return 1; if (i < O_MOT) return 2;
        if (i < O_DA) return 3; return 4;
      }
    };
  }

  return { createBrain };
}
// __NEURAL_CORE_END__

globalThis.__FlyBrainCore = __createFlyBrainCore();
