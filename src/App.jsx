import React, { useMemo, useRef, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// ---------- Utility helpers ----------
const rand = (a=0, b=1) => a + Math.random()*(b-a);
const dist2 = (a, b) => (a.x-b.x)**2 + (a.y-b.y)**2;
const sigmoid = (z) => 1/(1+Math.exp(-z));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function giniImpurity(counts){
  const n = Object.values(counts).reduce((s,c)=>s+c,0);
  if(n===0) return 0;
  let sum = 0;
  for(const c of Object.values(counts)){
    const p = c/n; sum += p*(1-p);
  }
  return sum;
}

function infoGain(parentCounts, leftCounts, rightCounts){
  const nP = Object.values(parentCounts).reduce((s,c)=>s+c,0);
  const nL = Object.values(leftCounts).reduce((s,c)=>s+c,0);
  const nR = Object.values(rightCounts).reduce((s,c)=>s+c,0);
  const gP = giniImpurity(parentCounts);
  const gL = giniImpurity(leftCounts);
  const gR = giniImpurity(rightCounts);
  return gP - (nL/nP)*gL - (nR/nP)*gR;
}

// Map coord [0,1]x[0,1] to SVG px
function toPx(x, y, size){
  return { cx: 16 + x*(size-32), cy: 16 + (1-y)*(size-32) };
}

// Random dataset generator
function makeClusters({n=60, centers=[{x:0.3,y:0.7,label:"A"},{x:0.7,y:0.3,label:"B"}], spread=0.12}){
  const pts = [];
  for(let i=0;i<n;i++){
    const c = centers[i%centers.length];
    pts.push({
      id: i+"-"+Math.random().toString(36).slice(2,6),
      x: clamp(c.x + rand(-spread, spread),0,1),
      y: clamp(c.y + rand(-spread, spread),0,1),
      label: c.label
    });
  }
  return pts;
}

// ---------- Mini charts & metrics ----------
function trapz(xs, ys){
  let a=0; for(let i=1;i<xs.length;i++){ a += (xs[i]-xs[i-1])*(ys[i]+ys[i-1])/2; } return a;
}

function MiniPlot({points, width=320, height=220, xLabel, yLabel, diag=false, baseline=null}){
  const pad = 32;
  const xs = points.map(p=>p.x), ys = points.map(p=>p.y);
  const xMax = Math.max(1, ...xs); const yMax = Math.max(1, ...ys);
  const toX = v => pad + v/(xMax||1) * (width-2*pad);
  const toY = v => (height-pad) - v/(yMax||1) * (height-2*pad);
  const path = points.map((p,i)=> `${i?"L":"M"}${toX(p.x)},${toY(p.y)}`).join(" ");
  return (
    <svg width={width} height={height} className="rounded-xl bg-white border shadow-sm">
      {/* axes */}
      <line x1={pad} y1={pad} x2={pad} y2={height-pad} className="stroke-gray-300"/>
      <line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} className="stroke-gray-300"/>
      {/* diag */}
      {diag && <line x1={pad} y1={height-pad} x2={width-pad} y2={pad} className="stroke-gray-200"/>}
      {/* baseline */}
      {baseline!==null && <line x1={pad} y1={toY(baseline)} x2={width-pad} y2={toY(baseline)} className="stroke-gray-200"/>}
      {/* curve */}
      <path d={path} className="fill-none stroke-gray-700"/>
      {/* ticks */}
      <text x={width/2} y={height-6} className="text-[10px] fill-gray-500" textAnchor="middle">{xLabel}</text>
      <text x={10} y={height/2} className="text-[10px] fill-gray-500 -rotate-90" transform={`rotate(-90 10 ${height/2})`}>{yLabel}</text>
    </svg>
  );
}

function MetricsPanel({probs, labels, threshold, onThresholdChange}){
  // labels: 'A' is positive class
  const thr = threshold ?? 0.5;
  const preds = probs.map(p=> p>=thr ? 'A' : 'B');
  const cm = {TP:0, FP:0, TN:0, FN:0};
  for(let i=0;i<labels.length;i++){
    const y = labels[i]==='A'; const yhat = preds[i]==='A';
    if(y && yhat) cm.TP++; else if(!y && yhat) cm.FP++; else if(!y && !yhat) cm.TN++; else cm.FN++;
  }
  const acc = (cm.TP+cm.TN)/(labels.length||1);
  const prec = cm.TP/(cm.TP+cm.FP||1);
  const rec = cm.TP/(cm.TP+cm.FN||1);
  const spec = cm.TN/(cm.TN+cm.FP||1);
  const f1 = (2*prec*rec)/((prec+rec)||1);

  // ROC & PR curves by sweeping threshold 1->0
  const taus = Array.from({length:51},(_,i)=> i/50).reverse();
  const roc = []; const pr = [];
  for(const t of taus){
    let TP=0,FP=0,TN=0,FN=0;
    for(let i=0;i<labels.length;i++){
      const y = labels[i]==='A';
      const yhat = probs[i]>=t;
      if(y && yhat) TP++; else if(!y && yhat) FP++; else if(!y && !yhat) TN++; else FN++;
    }
    const TPR = TP/(TP+FN||1); const FPR = FP/(FP+TN||1);
    const precision = TP/(TP+FP||1); const recall = TPR;
    roc.push({x:FPR, y:TPR});
    pr.push({x:recall, y:precision});
  }
  // Ensure ROC starts at (0,0) and ends at (1,1)
  roc.unshift({x:0,y:0}); roc.push({x:1,y:1});
  // Sort for AUC
  roc.sort((a,b)=>a.x-b.x); pr.sort((a,b)=>a.x-b.x);
  const aucRoc = trapz(roc.map(p=>p.x), roc.map(p=>p.y));
  const aucPr = trapz(pr.map(p=>p.x), pr.map(p=>p.y));
  const basePr = labels.filter(l=>l==='A').length/(labels.length||1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {onThresholdChange && (
          <div className="flex items-center gap-2 w-64">
            <Label>Threshold {thr.toFixed(2)}</Label>
            <Slider value={[thr]} min={0.0} max={1.0} step={0.01} onValueChange={([v])=>onThresholdChange(v)} />
          </div>
        )}
        <div className="ml-auto grid grid-cols-5 gap-3 text-center">
          <div className="p-2 rounded-lg bg-muted"><div className="text-[11px] uppercase">Accuracy</div><div className="text-base font-semibold">{(acc*100).toFixed(1)}%</div></div>
          <div className="p-2 rounded-lg bg-muted"><div className="text-[11px] uppercase">Precision</div><div className="text-base font-semibold">{(prec*100).toFixed(1)}%</div></div>
          <div className="p-2 rounded-lg bg-muted"><div className="text-[11px] uppercase">Recall</div><div className="text-base font-semibold">{(rec*100).toFixed(1)}%</div></div>
          <div className="p-2 rounded-lg bg-muted"><div className="text-[11px] uppercase">Specificity</div><div className="text-base font-semibold">{(spec*100).toFixed(1)}%</div></div>
          <div className="p-2 rounded-lg bg-muted"><div className="text-[11px] uppercase">F1</div><div className="text-base font-semibold">{(f1*100).toFixed(1)}%</div></div>
        </div>
      </div>

      {/* Confusion matrix */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="py-3"><CardTitle className="text-base">Confusion Matrix (Positive=A)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 text-sm">
              <div></div>
              <div className="text-center font-medium">Pred A</div>
              <div className="text-center font-medium">Pred B</div>
              <div className="font-medium">Actual A</div>
              <div className="text-center p-2 rounded-md bg-emerald-50 border">{cm.TP}</div>
              <div className="text-center p-2 rounded-md bg-rose-50 border">{cm.FN}</div>
              <div className="font-medium">Actual B</div>
              <div className="text-center p-2 rounded-md bg-rose-50 border">{cm.FP}</div>
              <div className="text-center p-2 rounded-md bg-emerald-50 border">{cm.TN}</div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">ROC AUC: {aucRoc.toFixed(3)} &nbsp;•&nbsp; PR AUC: {aucPr.toFixed(3)} (baseline ≈ {basePr.toFixed(2)})</div>
          <MiniPlot points={roc} xLabel="FPR" yLabel="TPR" diag/>
          <MiniPlot points={pr} xLabel="Recall" yLabel="Precision" baseline={basePr}/>
        </div>
      </div>
    </div>
  );
}

// ---------- Core Canvas ----------
function Plot({points, size=420, onClick, highlightIds=new Set(), testPoint, centroids=[], boundaries=[], shadeFn, showGrid=true}){
  return (
    <svg width={size} height={size} className="rounded-2xl bg-white shadow border" onClick={(e)=>{
      const rect = e.currentTarget.getBoundingClientRect();
      const x = clamp((e.clientX-rect.left-16)/(size-32),0,1);
      const y = clamp(1- (e.clientY-rect.top-16)/(size-32),0,1);
      onClick && onClick({x,y});
    }}>
      {/* grid */}
      {showGrid && Array.from({length:9}).map((_,i)=>{
        const p = 16 + (i+1)*(size-32)/10;
        return (
          <g key={i}>
            <line x1={p} y1={16} x2={p} y2={size-16} className="stroke-gray-100"/>
            <line x1={16} y1={p} x2={size-16} y2={p} className="stroke-gray-100"/>
          </g>
        );
      })}

      {/* probability shading */}
      {shadeFn && (()=>{
        const cells = 60; const cell = (size-32)/cells;
        const rects = [];
        for(let i=0;i<cells;i++){
          for(let j=0;j<cells;j++){
            const x = i/(cells-1); const y = j/(cells-1);
            const p = shadeFn({x,y});
            const alpha = 0.2 + 0.5*Math.abs(p-0.5)*2; // stronger away from 0.5
            const color = p>=0.5? `rgba(37,99,235,${alpha})` : `rgba(239,68,68,${alpha})`;
            const {cx,cy} = toPx(i/(cells-1), j/(cells-1), size);
            rects.push(<rect key={`r-${i}-${j}`} x={cx} y={cy} width={cell} height={cell} fill={color} />);
          }
        }
        return <g opacity={0.35}>{rects}</g>;
      })()}

      {/* decision boundaries */}
      {boundaries.map((b, idx)=>{
        if(b.type==="line"){
          const p1 = toPx(0, b.m*0 + b.c, size);
          const p2 = toPx(1, b.m*1 + b.c, size);
          return <line key={idx} x1={p1.cx} y1={p1.cy} x2={p2.cx} y2={p2.cy} className="stroke-gray-600" strokeDasharray="6 4"/>;
        }
        if(b.type==="vsplit"){
          const p = toPx(b.t, 0, size);
          return <line key={idx} x1={p.cx} y1={16} x2={p.cx} y2={size-16} className="stroke-gray-700" strokeDasharray="4 6"/>;
        }
        if(b.type==="hsplit"){
          const p = toPx(0, b.t, size);
          return <line key={idx} x1={16} y1={p.cy} x2={size-16} y2={p.cy} className="stroke-gray-700" strokeDasharray="4 6"/>;
        }
        return null;
      })}

      {/* centroids */}
      {centroids.map((c, i)=>{
        const {cx,cy} = toPx(c.x,c.y,size);
        return (
          <g key={"cent"+i}>
            <circle cx={cx} cy={cy} r={10} className="fill-yellow-300 stroke-yellow-700"/>
            <text x={cx} y={cy+4} textAnchor="middle" className="text-xs fill-yellow-950 font-semibold">C{i+1}</text>
          </g>
        );
      })}

      {/* points */}
      {points.map(p=>{
        const {cx,cy} = toPx(p.x,p.y,size);
        const isHL = highlightIds.has(p.id);
        const color = p.label==='A'?"fill-blue-500 stroke-blue-700":"fill-rose-500 stroke-rose-700";
        return (
          <g key={p.id}>
            <circle cx={cx} cy={cy} r={isHL?7:5} className={cn(color, isHL && "ring-2 ring-offset-1 ring-amber-400")} />
          </g>
        );
      })}

      {/* test point */}
      {testPoint && (()=>{
        const {cx,cy} = toPx(testPoint.x,testPoint.y,size);
        return (
          <g>
            <circle cx={cx} cy={cy} r={8} className="fill-white stroke-gray-900"/>
            <circle cx={cx} cy={cy} r={12} className="fill-transparent stroke-gray-400" strokeDasharray="4 3"/>
          </g>
        );
      })()}

      {/* frame */}
      <rect x={16} y={16} width={size-32} height={size-32} className="fill-none stroke-gray-300 rounded-xl" rx={12} />
    </svg>
  );
}

// ---------- k-NN Game ----------
function KNNGame(){
  const [points, setPoints] = useState(()=>makeClusters({n:60}));
  const [mode, setMode] = useState("addA"); // addA, addB, addTest
  const [k, setK] = useState(5);
  const [test, setTest] = useState(null);
  const [neighbors, setNeighbors] = useState([]);
  const [pred, setPred] = useState(null);

  function handleClick({x,y}){
    if(mode==="addA"||mode==="addB"){
      const label = mode==="addA"?"A":"B";
      setPoints(p=>[...p,{id:crypto.randomUUID(),x,y,label}]);
    } else if(mode==="addTest"){
      setTest({x,y});
    }
  }

  // For the single test point demo
  useEffect(()=>{
    if(!test) { setNeighbors([]); setPred(null); return; }
    const withD = points.map(p=>({p, d: dist2(p, test)})).sort((a,b)=>a.d-b.d).slice(0,k);
    setNeighbors(withD.map(w=>w.p.id));
    const counts = withD.reduce((acc,{p})=>{acc[p.label]=(acc[p.label]||0)+1; return acc;},{});
    const guess = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
    setPred(guess);
  }, [test, points, k]);

  // Leave-one-out probabilities for metrics
  const looProbs = useMemo(()=>{
    if(points.length===0) return [];
    return points.map((pt,i)=>{
      const others = points.filter((_,j)=>j!==i);
      const neigh = others.map(p=>({p, d: dist2(p, pt)})).sort((a,b)=>a.d-b.d).slice(0,k);
      const countA = neigh.reduce((s,{p})=>s + (p.label==='A'), 0);
      return countA/Math.max(1,k);
    });
  },[points, k]);
  const labels = useMemo(()=>points.map(p=>p.label),[points]);

  const [thKNN, setThKNN] = useState(0.5);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Playground</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-center">
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="addA">Click to add Class A (blue)</SelectItem>
                <SelectItem value="addB">Click to add Class B (red)</SelectItem>
                <SelectItem value="addTest">Click to place Test Point</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-3 ml-4">
              <Label className="text-sm">k = {k}</Label>
              <Slider value={[k]} min={1} max={15} step={2} onValueChange={([v])=>setK(v)} className="w-48"/>
            </div>
            <Button variant="secondary" className="ml-auto" onClick={()=>{setPoints(makeClusters({n:60})); setTest(null);}}>Reset Data</Button>
          </div>
          <Plot points={points} onClick={handleClick} testPoint={test} highlightIds={new Set(neighbors)} />
          <div className="text-sm text-muted-foreground">Prediction: {pred? (pred==='A'? 'Class A (blue)':'Class B (red)') : '—'} | Neighbors highlighted with glow.</div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Metrics (LOO on current data)</CardTitle>
        </CardHeader>
        <CardContent>
          <MetricsPanel probs={looProbs} labels={labels} threshold={thKNN} onThresholdChange={setThKNN}/>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- k-Means Game ----------
function KMeansGame(){
  const [points, setPoints] = useState(()=>makeClusters({n:80, centers:[{x:0.25,y:0.75,label:"A"},{x:0.5,y:0.3,label:"B"},{x:0.78,y:0.7,label:"A"}], spread:0.1}).map(p=>({...p,label:undefined})));
  const [k, setK] = useState(3);
  const [centroids, setCentroids] = useState(()=>Array.from({length:3}).map(()=>({x:rand(0.2,0.8),y:rand(0.2,0.8)})));
  const [assign, setAssign] = useState({});
  const [sse, setSSE] = useState(0);
  const [auto, setAuto] = useState(false);

  function randomize(){
    setPoints(makeClusters({n:80, centers:[{x:0.25,y:0.75,label:"A"},{x:0.5,y:0.3,label:"B"},{x:0.78,y:0.7,label:"A"}], spread:0.1}).map(p=>({...p,label:undefined})));
    setCentroids(Array.from({length:k}).map(()=>({x:rand(0.15,0.85),y:rand(0.15,0.85)})));
    setAssign({}); setSSE(0);
  }

  function stepAssign(){
    const newAssign = {};
    let total = 0;
    for(const p of points){
      let best=0, bestD=Infinity;
      for(let i=0;i<k;i++){
        const d = dist2(p, centroids[i]);
        if(d<bestD){ bestD=d; best=i; }
      }
      newAssign[p.id]=best; total += bestD;
    }
    setAssign(newAssign); setSSE(total);
  }
  function stepUpdate(){
    const groups = Array.from({length:k}).map(()=>[]);
    points.forEach(p=>{
      const a = assign[p.id]; if(a!==undefined) groups[a].push(p);
    });
    const newC = groups.map(g=>{
      if(g.length===0) return {x:rand(0.1,0.9),y:rand(0.1,0.9)};
      return { x: g.reduce((s,p)=>s+p.x,0)/g.length, y: g.reduce((s,p)=>s+p.y,0)/g.length };
    });
    setCentroids(newC);
  }

  useEffect(()=>{
    if(!auto) return;
    const t = setInterval(()=>{ stepAssign(); setTimeout(stepUpdate, 120); }, 260);
    return ()=>clearInterval(t);
  },[auto, points, k, centroids]);

  const coloredPoints = useMemo(()=>{
    const palette = ["fill-emerald-500 stroke-emerald-700","fill-sky-500 stroke-sky-700","fill-fuchsia-500 stroke-fuchsia-700","fill-amber-500 stroke-amber-700","fill-lime-500 stroke-lime-700"]; 
    return points.map(p=>{
      const a = assign[p.id];
      const cls = a===undefined?"fill-gray-400 stroke-gray-600":palette[a%palette.length];
      return {...p, label: a===undefined?"U":"C"+a, colorCls: cls };
    });
  },[points, assign]);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Playground</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-3">
              <Label className="text-sm">k = {k}</Label>
              <Slider value={[k]} min={2} max={5} step={1} onValueChange={([v])=>{setK(v); setCentroids(Array.from({length:v}).map(()=>({x:rand(0.2,0.8),y:rand(0.2,0.8)}))); setAssign({});}} className="w-44"/>
            </div>
            <Button onClick={stepAssign} variant="secondary">Step 1: Assign</Button>
            <Button onClick={stepUpdate} variant="secondary">Step 2: Update Centroids</Button>
            <div className="flex items-center gap-2 ml-2">
              <Switch checked={auto} onCheckedChange={setAuto} id="auto"/>
              <Label htmlFor="auto">Auto-run</Label>
            </div>
            <Button className="ml-auto" onClick={randomize}>Reset</Button>
          </div>
          <Plot points={coloredPoints} centroids={centroids} onClick={(p)=>setPoints(prev=>[...prev,{id:crypto.randomUUID(),...p}])} />
          <div className="text-sm text-muted-foreground">SSE (sum of squared distances): {sse.toFixed(2)}</div>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>What you learn</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ul className="list-disc pl-5 space-y-1">
            <li>Two alternating steps: <strong>Assign</strong> points to nearest centroid, then <strong>Update</strong> centroids to the mean.</li>
            <li>Objective: minimize within-cluster sum of squares (SSE); it never increases after a full iteration.</li>
            <li>Different initial centroids can give different local optima; try Reset a few times.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Decision Tree Splitter ----------
function DecisionTreeGame(){
  const [points, setPoints] = useState(()=>makeClusters({n:60, centers:[{x:0.3,y:0.75,label:"A"},{x:0.7,y:0.25,label:"B"}], spread:0.14}));
  const [axis, setAxis] = useState("x");
  const [thr, setThr] = useState(0.5);

  const parentCounts = useMemo(()=>{
    return points.reduce((acc,p)=>{acc[p.label]=(acc[p.label]||0)+1; return acc;},{});
  },[points]);

  const {leftCounts, rightCounts} = useMemo(()=>{
    const L={}, R={};
    points.forEach(p=>{
      const val = axis==='x'? p.x : p.y;
      const side = val <= thr ? L : R;
      side[p.label] = (side[p.label]||0)+1;
    });
    return {leftCounts:L, rightCounts:R};
  },[points, axis, thr]);

  const gain = useMemo(()=>infoGain(parentCounts,leftCounts,rightCounts),[parentCounts,leftCounts,rightCounts]);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Choose a Split</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={axis} onValueChange={setAxis}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="x">Split on X (feature 1)</SelectItem>
                <SelectItem value="y">Split on Y (feature 2)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-3">
              <Label>Threshold: {thr.toFixed(2)}</Label>
              <Slider value={[thr]} min={0} max={1} step={0.01} onValueChange={([v])=>setThr(v)} className="w-48"/>
            </div>
            <Button variant="secondary" className="ml-auto" onClick={()=>setPoints(makeClusters({n:60, centers:[{x:0.3,y:0.75,label:"A"},{x:0.7,y:0.25,label:"B"}], spread:0.14}))}>Reset Data</Button>
          </div>
          <Plot points={points} boundaries={[axis==='x'?{type:'vsplit', t:thr}:{type:'hsplit',t:thr}]} />
        </CardContent>
      </Card>
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Impurity & Information Gain</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl bg-muted">
              <div className="text-xs uppercase tracking-wide">Parent Gini</div>
              <div className="text-2xl font-semibold">{giniImpurity(parentCounts).toFixed(3)}</div>
              <div className="text-[11px] text-muted-foreground">Counts: {JSON.stringify(parentCounts)}</div>
            </div>
            <div className="p-3 rounded-xl bg-muted">
              <div className="text-xs uppercase tracking-wide">Left Gini</div>
              <div className="text-2xl font-semibold">{giniImpurity(leftCounts).toFixed(3)}</div>
              <div className="text-[11px] text-muted-foreground">≤ threshold: {JSON.stringify(leftCounts)}</div>
            </div>
            <div className="p-3 rounded-xl bg-muted">
              <div className="text-xs uppercase tracking-wide">Right Gini</div>
              <div className="text-2xl font-semibold">{giniImpurity(rightCounts).toFixed(3)}</div>
              <div className="text-[11px] text-muted-foreground">&gt; threshold: {JSON.stringify(rightCounts)}</div>
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <div className="text-xs uppercase tracking-wide text-amber-800">Information Gain</div>
            <div className="text-3xl font-bold text-amber-900">{gain.toFixed(3)}</div>
            <div className="text-xs text-amber-900/80 mt-2">Drag the threshold to maximize gain. This is exactly what a decision tree does greedily at each node.</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Logistic Regression Sandbox ----------
function LogisticGame(){
  const [points, setPoints] = useState(()=>makeClusters({n:70, centers:[{x:0.3,y:0.7,label:"A"},{x:0.7,y:0.3,label:"B"}], spread:0.12}));
  const [w0, setW0] = useState(0);
  const [w1, setW1] = useState(8);
  const [w2, setW2] = useState(-8);
  const [thr, setThr] = useState(0.5);

  const predictProb = ({x,y}) => sigmoid(w0 + w1*x + w2*y);
  const shadeFn = (p)=> predictProb(p);

  const probs = useMemo(()=> points.map(p=> predictProb(p)), [points, w0, w1, w2]);
  const labels = useMemo(()=> points.map(p=> p.label), [points]);

  const predicted = useMemo(()=>{
    return probs.map((pr,i)=>{
      const yhat = pr>=thr? 'A':'B';
      return {...points[i], pred: yhat, prob: pr};
    });
  },[points, probs, thr]);

  const acc = useMemo(()=>{
    const n = predicted.length;
    const ok = predicted.filter(p=>p.pred===p.label).length;
    return ok/n;
  },[predicted]);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Probability Field & Threshold</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 items-center">
            <div className="col-span-2 flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2 w-56"><Label>w0</Label><Slider value={[w0]} min={-10} max={10} step={0.1} onValueChange={([v])=>setW0(v)} /></div>
              <div className="flex items-center gap-2 w-56"><Label>w1</Label><Slider value={[w1]} min={-20} max={20} step={0.2} onValueChange={([v])=>setW1(v)} /></div>
              <div className="flex items-center gap-2 w-56"><Label>w2</Label><Slider value={[w2]} min={-20} max={20} step={0.2} onValueChange={([v])=>setW2(v)} /></div>
              <div className="flex items-center gap-2 w-56"><Label>Threshold {thr.toFixed(2)}</Label><Slider value={[thr]} min={0.05} max={0.95} step={0.01} onValueChange={([v])=>setThr(v)} /></div>
              <Button className="ml-auto" variant="secondary" onClick={()=>{setPoints(makeClusters({n:70, centers:[{x:0.3,y:0.7,label:"A"},{x:0.7,y:0.3,label:"B"}], spread:0.12}));}}>Reset Data</Button>
            </div>
          </div>
          <Plot points={points} shadeFn={shadeFn} />
          <div className="text-sm text-muted-foreground">Adjust weights to tilt/shift the probability field; move threshold to trade off precision/recall. Current accuracy: {(acc*100).toFixed(1)}%.</div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Metrics (on current data)</CardTitle>
        </CardHeader>
        <CardContent>
          <MetricsPanel probs={probs} labels={labels} threshold={thr} onThresholdChange={setThr}/>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- App Shell ----------
export default function App(){
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">ML Playground — Classroom Game</h1>
        <p className="text-muted-foreground mt-2">Click to add data points, tweak parameters, and watch the algorithms learn in real time. Built for quick demos in UG/PG/PhD classes.</p>
      </header>

      <Tabs defaultValue="knn" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full">
          <TabsTrigger value="knn">k-NN</TabsTrigger>
          <TabsTrigger value="kmeans">k-Means</TabsTrigger>
          <TabsTrigger value="tree">Decision Tree</TabsTrigger>
          <TabsTrigger value="logit">Logistic</TabsTrigger>
        </TabsList>

        <TabsContent value="knn" className="mt-4"><KNNGame/></TabsContent>
        <TabsContent value="kmeans" className="mt-4"><KMeansGame/></TabsContent>
        <TabsContent value="tree" className="mt-4"><DecisionTreeGame/></TabsContent>
        <TabsContent value="logit" className="mt-4"><LogisticGame/></TabsContent>
      </Tabs>

      <footer className="mt-10 text-xs text-muted-foreground">
        Pro tip: Project to a screen; let students take turns adding points or choosing parameters. Discuss accuracy vs precision/recall, ROC vs PR, local vs global methods, and objective functions.
      </footer>
    </div>
  );
}
