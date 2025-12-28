// ===== 全域變數 =====
let calculator;
let currentResults = [];
let currentFunction = '';
let currentPoint = { x: 0, y: 0 };
let tutorialSteps = [];
let currentStepIndex = 0;
let sliderAnimationInterval = null;

const COLORS = {
    primary: '#007AFF',
    function: '#1D1D1F',
    point: '#007AFF',
    tangent: '#007AFF',
    tangentPoint: '#86868B',
    ghost: '#FF9500'
};

// ===== Desmos 初始化 =====
function initDesmos() {
    const elt = document.getElementById('calculator');
    calculator = Desmos.GraphingCalculator(elt, {
        keypad: false,
        expressions: false,
        settingsMenu: false,
        zoomButtons: true,
        expressionsTopbar: false,
        pointsOfInterest: false,
        trace: false,
        border: false,
        lockViewport: false,
    });
}

// ===== 多項式運算核心 (PolynomialHelper) =====
class PolynomialHelper {
    static extractCoefficients(funcStr, maxDegree = 10) {
        try {
            const compiled = math.compile(funcStr);
            const coeffs = [];
            
            for (let n = 0; n <= maxDegree; n++) {
                let derivative = compiled;
                for (let i = 0; i < n; i++) {
                    const node = math.derivative(derivative, 'x');
                    derivative = node.compile();
                }
                
                const value = derivative.evaluate({ x: 0 });
                const factorial = this.factorial(n);
                coeffs.push(value / factorial);
            }
            
            while (coeffs.length > 1 && Math.abs(coeffs[coeffs.length - 1]) < 1e-10) {
                coeffs.pop();
            }
            
            return coeffs;
        } catch (error) {
            console.error('係數提取失敗:', error);
            return [0];
        }
    }
    
    static factorial(n) {
        if (n <= 1) return 1;
        return n * this.factorial(n - 1);
    }
    
    static multiply(poly1, poly2) {
        const result = new Array(poly1.length + poly2.length - 1).fill(0);
        for (let i = 0; i < poly1.length; i++) {
            for (let j = 0; j < poly2.length; j++) {
                result[i + j] += poly1[i] * poly2[j];
            }
        }
        return result;
    }
    
    static add(poly1, poly2) {
        const maxLen = Math.max(poly1.length, poly2.length);
        const result = [];
        for (let i = 0; i < maxLen; i++) {
            const a = i < poly1.length ? poly1[i] : 0;
            const b = i < poly2.length ? poly2[i] : 0;
            result.push(a + b);
        }
        return result;
    }
    
    static subtract(poly1, poly2) {
        const maxLen = Math.max(poly1.length, poly2.length);
        const result = [];
        for (let i = 0; i < maxLen; i++) {
            const a = i < poly1.length ? poly1[i] : 0;
            const b = i < poly2.length ? poly2[i] : 0;
            result.push(a - b);
        }
        return result;
    }
    
    static toHtml(coeffs, variable = 'a', showZero = false) {
        const terms = [];
        
        for (let i = coeffs.length - 1; i >= 0; i--) {
            const coeff = coeffs[i];
            
            if (!showZero && Math.abs(coeff) < 1e-10) continue;
            
            let term = '';
            const absCoeff = Math.abs(coeff);
            const sign = coeff > 0 ? '+' : '−';
            
            if (i === 0) {
                term = this.formatNumber(absCoeff);
            } else if (Math.abs(absCoeff - 1) < 1e-10) {
                term = '';
            } else {
                term = this.formatNumber(absCoeff);
            }
            
            if (i === 1) {
                term += `<i>${variable}</i>`;
            } else if (i > 1) {
                term += `<i>${variable}</i><sup>${i}</sup>`;
            }
            
            terms.push({ sign: sign, term: term });
        }
        
        if (terms.length === 0) return '0';
        
        let html = '';
        terms.forEach((t, idx) => {
            if (idx === 0) {
                html += t.sign === '−' ? '−' + t.term : t.term;
            } else {
                html += ` ${t.sign} ${t.term}`;
            }
        });
        
        return html;
    }
    
    static formatNumber(num) {
        if (Math.abs(num - Math.round(num)) < 1e-10) {
            return Math.round(num).toString();
        }
        return num.toFixed(2).replace(/\.?0+$/, '');
    }
    
    static getSingleTerm(coeff, power, variable = 'a') {
        if (Math.abs(coeff) < 1e-10) return '0';
        
        let term = '';
        const absCoeff = Math.abs(coeff);
        const sign = coeff < 0 ? '−' : '';
        
        if (power === 0) {
            term = this.formatNumber(absCoeff);
        } else if (Math.abs(absCoeff - 1) < 1e-10) {
            term = '';
        } else {
            term = this.formatNumber(absCoeff);
        }
        
        if (power === 1) {
            term += `<i>${variable}</i>`;
        } else if (power > 1) {
            term += `<i>${variable}</i><sup>${power}</sup>`;
        }
        
        return sign + term;
    }
}

// ===== 數學核心函數 =====
function parseFunction(funcStr) {
    try {
        const processed = funcStr.replace(/\^/g, '^');
        const node = math.parse(processed);
        return node.compile();
    } catch (error) {
        throw new Error('函數格式錯誤');
    }
}

function evaluateFunction(compiled, x) {
    try {
        return compiled.evaluate({ x: x });
    } catch (error) {
        return null;
    }
}

function numericalDerivative(compiled, x, h = 1e-7) {
    const f1 = evaluateFunction(compiled, x + h);
    const f2 = evaluateFunction(compiled, x - h);
    if (f1 === null || f2 === null) return null;
    return (f1 - f2) / (2 * h);
}

// ===== 切點搜尋算法 =====
function findTangentPoints(compiled, x0, y0) {
    const tangentPoints = [];
    const derivativeFunc = (x) => numericalDerivative(compiled, x);
    
    const targetFunction = (t) => {
        if (Math.abs(t - x0) < 1e-10) return Infinity;
        const ft = evaluateFunction(compiled, t);
        const fPrime = derivativeFunc(t);
        if (ft === null || fPrime === null) return Infinity;
        return fPrime * (t - x0) - (ft - y0);
    };
    
    const allInitialGuesses = new Set();
    const searchScales = [
        { range: 100, samples: 500 },
        { range: 50, samples: 300 },
        { range: 20, samples: 200 }
    ];
    
    for (let scale of searchScales) {
        const baseRange = Math.max(Math.abs(x0) * 2, scale.range);
        const start = x0 - baseRange;
        const end = x0 + baseRange;
        
        for (let i = 0; i < scale.samples - 1; i++) {
            const t1 = start + (end - start) * i / scale.samples;
            const t2 = start + (end - start) * (i + 1) / scale.samples;
            
            const g1 = targetFunction(t1);
            const g2 = targetFunction(t2);
            
            if (g1 !== Infinity && g2 !== Infinity && g1 * g2 < 0) {
                allInitialGuesses.add((t1 + t2) / 2);
            }
        }
    }
    
    const denseRange = Math.max(Math.abs(x0) * 3, 30);
    for (let i = 0; i < 400; i++) {
        const t = x0 - denseRange + (2 * denseRange) * i / 400;
        allInitialGuesses.add(t);
    }
    
    for (let initialGuess of allInitialGuesses) {
        let t = initialGuess;
        let converged = false;
        
        for (let iter = 0; iter < 50; iter++) {
            const G = targetFunction(t);
            if (G === Infinity || Math.abs(G) > 1e10) break;
            
            const h = 1e-6;
            const G_plus = targetFunction(t + h);
            const G_minus = targetFunction(t - h);
            
            if (G_plus === Infinity || G_minus === Infinity) break;
            
            const GPrime = (G_plus - G_minus) / (2 * h);
            if (Math.abs(GPrime) < 1e-12) break;
            
            const tNew = t - G / GPrime;
            
            if (Math.abs(tNew - t) < 1e-8 && Math.abs(G) < 1e-7) {
                converged = true;
                t = tNew;
                break;
            }
            
            t = tNew;
            if (Math.abs(t) > 1e4 || isNaN(t)) break;
        }
        
        if (converged && Math.abs(t) < 1e4) {
            const ft = evaluateFunction(compiled, t);
            const fPrime = derivativeFunc(t);
            
            if (ft !== null && fPrime !== null) {
                const expectedSlope = (ft - y0) / (t - x0);
                if (Math.abs(fPrime - expectedSlope) < 0.1) {
                    let isDuplicate = false;
                    for (let existing of tangentPoints) {
                        if (Math.abs(existing.t - t) < 0.005) {
                            isDuplicate = true;
                            break;
                        }
                    }
                    
                    if (!isDuplicate) {
                        tangentPoints.push({
                            t: t,
                            x: t,
                            y: ft,
                            slope: fPrime
                        });
                    }
                }
            }
        }
    }
    
    tangentPoints.sort((a, b) => a.t - b.t);
    return tangentPoints;
}

// ===== 視窗範圍計算 =====
function calculateViewBounds(compiled, x0, y0, tangentPoints) {
    let xMin = x0, xMax = x0, yMin = y0, yMax = y0;
    
    for (let point of tangentPoints) {
        xMin = Math.min(xMin, point.x);
        xMax = Math.max(xMax, point.x);
        yMin = Math.min(yMin, point.y);
        yMax = Math.max(yMax, point.y);
    }
    
    const xRange = Math.max(xMax - xMin, 5);
    const yRange = Math.max(yMax - yMin, 5);
    const paddingX = xRange * 0.4;
    const paddingY = yRange * 0.4;
    
    return {
        left: xMin - paddingX,
        right: xMax + paddingX,
        bottom: yMin - paddingY,
        top: yMax + paddingY
    };
}

// ===== 主要視覺化函數 =====
function visualize(funcStr, x0, y0, compressView = false) {
    const compiled = parseFunction(funcStr);
    calculator.setBlank();
    
    calculator.setExpression({
        id: 'function',
        latex: funcStr,
        color: COLORS.function,
        lineWidth: 3
    });
    
    calculator.setExpression({
        id: 'point-P',
        latex: `P=(${x0},${y0})`,
        color: COLORS.point,
        pointSize: 12,
        label: 'P',
        showLabel: true
    });
    
    const tangentPoints = findTangentPoints(compiled, x0, y0);
    
    if (tangentPoints.length === 0) {
        throw new Error('找不到切線解');
    }
    
    const results = [];
    tangentPoints.forEach((point, index) => {
        calculator.setExpression({
            id: `tangent-point-${index}`,
            latex: `(${point.x},${point.y})`,
            color: COLORS.tangentPoint,
            pointSize: 9
        });
        
        const m = point.slope;
        const b = y0 - m * x0;
        
        calculator.setExpression({
            id: `tangent-line-${index}`,
            latex: `y=${m}x+${b}`,
            color: COLORS.tangent,
            lineWidth: 2.5,
            lineOpacity: 0.8
        });
        
        results.push({ point: point, slope: m, intercept: b });
    });
    
    let bounds = calculateViewBounds(compiled, x0, y0, tangentPoints);
    
    if (compressView) {
        const range = bounds.top - bounds.bottom;
        bounds.top = bounds.bottom + range * 0.65;
    }
    
    calculator.setMathBounds(bounds);
    
    return { results, bounds };
}

// ===== 方程式美化 =====
function formatEquation(slope, intercept) {
    let slopeStr = '';
    if (Math.abs(slope) < 1e-10) {
        slopeStr = '';
    } else if (Math.abs(slope - 1) < 1e-10) {
        slopeStr = 'x';
    } else if (Math.abs(slope + 1) < 1e-10) {
        slopeStr = '-x';
    } else if (Math.abs(slope - Math.round(slope)) < 1e-10) {
        slopeStr = `${Math.round(slope)}x`;
    } else {
        slopeStr = `${(Math.round(slope * 1000) / 1000)}x`;
    }
    
    let interceptStr = '';
    if (Math.abs(intercept) < 1e-10) {
        interceptStr = '';
    } else if (Math.abs(intercept - Math.round(intercept)) < 1e-10) {
        const intIntercept = Math.round(intercept);
        interceptStr = intIntercept > 0 ? ` + ${intIntercept}` : ` - ${Math.abs(intIntercept)}`;
    } else {
        const rounded = Math.round(intercept * 1000) / 1000;
        interceptStr = rounded > 0 ? ` + ${rounded}` : ` - ${Math.abs(rounded)}`;
    }
    
    if (slopeStr === '' && interceptStr === '') return 'y = 0';
    if (slopeStr === '') return `y = ${interceptStr.trim().replace(/^[+\-]\s*/, '')}`;
    if (interceptStr === '') return `y = ${slopeStr}`;
    return `y = ${slopeStr}${interceptStr}`;
}

// ===== 詳細教學步驟生成 (課本詳解風格) =====
function generateDetailedTutorialSteps(funcStr, x0, y0, tangentPoint) {
    const a = tangentPoint.t; // 解出來的切點 x 座標 (最後用來對答案)
    const steps = [];

    // 準備多項式運算所需的數據
    // f(a) 的係數
    const fCoeffs = PolynomialHelper.extractCoefficients(funcStr); 
    const fHtml = PolynomialHelper.toHtml(fCoeffs, 'a');

    // f'(a) 的係數
    const fPrimeCoeffs = [];
    for(let i=1; i<fCoeffs.length; i++) {
        fPrimeCoeffs.push(fCoeffs[i] * i); // 微分：次方乘下來，降一次
    }
    const fPrimeHtml = PolynomialHelper.toHtml(fPrimeCoeffs, 'a');

    // --- Step 1: 設切點與斜率 ---
    steps.push({
        title: 'Step 1: 設切點與斜率',
        subtitle: '利用微分求斜率',
        math: `切點 Q(a, f(a)) = (${fHtml}) <br> 斜率 m = f'(a) = ${fPrimeHtml}`,
        explanation: '設切點的 x 座標為 a，則切點座標與切線斜率如上所示。'
    });

    // --- Step 2: 點斜式 ---
    steps.push({
        title: 'Step 2: 建立切線方程式',
        subtitle: '利用點斜式',
        math: `y - f(a) = f'(a)(x - a)`,
        explanation: '通過切點 (a, f(a)) 且斜率為 f\'(a) 的直線方程式。'
    });

    // --- Step 3: 代入外點 ---
    steps.push({
        title: 'Step 3: 代入外點座標',
        subtitle: `將 P(${x0}, ${y0}) 代入`,
        math: `${y0} - (${fHtml}) = (${fPrimeHtml})(${x0} - a)`,
        explanation: `因為切線通過外點 P，將 x=${x0}, y=${y0} 代入切線方程式。`
    });

    // --- Step 4: 展開左邊 (LHS) ---
    // 計算 y0 - f(a)
    const y0Poly = [y0];
    const leftSidePoly = PolynomialHelper.subtract(y0Poly, fCoeffs);
    const leftSideHtml = PolynomialHelper.toHtml(leftSidePoly, 'a');
    
    steps.push({
        title: 'Step 4: 展開等號左邊',
        subtitle: '去括號整理',
        math: `${leftSideHtml} = (${fPrimeHtml})(${x0} - a)`,
        explanation: `計算等號左邊：${y0} - (${fHtml})`
    });

    // --- Step 5: 展開右邊 (RHS) ---
    // 計算 f'(a) * (x0 - a)
    // 先建立 (x0 - a) 的多項式係數: 常數項 x0, 一次項 -1
    const term2Poly = [x0, -1]; 
    const rightSidePoly = PolynomialHelper.multiply(fPrimeCoeffs, term2Poly);
    const rightSideHtml = PolynomialHelper.toHtml(rightSidePoly, 'a');

    steps.push({
        title: 'Step 5: 展開等號右邊',
        subtitle: '多項式乘法展開',
        math: `${leftSideHtml} = ${rightSideHtml}`,
        explanation: `計算等號右邊：(${fPrimeHtml}) × (${x0} - a)。利用分配律展開。`
    });

    // --- Step 6: 移項整理 ---
    // 全部移到左邊: LHS - RHS = 0
    // 或者 RHS - LHS = 0 (看最高次項係數正負，通常習慣讓最高次項為正)
    let finalPoly = PolynomialHelper.subtract(rightSidePoly, leftSidePoly);
    
    // 如果最高次項是負的，全體變號 (為了美觀)
    if (finalPoly.length > 0 && finalPoly[finalPoly.length-1] < 0) {
        finalPoly = finalPoly.map(c => -c);
    }
    const finalHtml = PolynomialHelper.toHtml(finalPoly, 'a');

    steps.push({
        title: 'Step 6: 移項並合併同類項',
        subtitle: '整理成標準式',
        math: `${finalHtml} = 0`,
        explanation: '將所有項移到同一邊，合併同類項，得到關於 a 的方程式。'
    });

    // --- Step 7: 求解 ---
    // 這裡我們直接顯示算出來的答案 a (因為前端解高次方程式步驟太複雜，直接給答案比較實際)
    const answerA = parseFloat(a.toFixed(3)); // 取小數點後三位
    
    steps.push({
        title: 'Step 7: 解方程式',
        subtitle: '求出切點 x 座標',
        math: `a \\approx ${answerA}`,
        explanation: `解上述方程式，得到 a 的值。`
    });

    // --- Step 8: 回推切線 ---
    const slope = tangentPoint.slope;
    const intercept = y0 - slope * x0; // b = y - mx
    const tangentEq = formatEquation(slope, intercept); // 使用你原本有的 formatEquation

    steps.push({
        title: 'Step 8: 寫出切線方程式',
        subtitle: '代回求出最終答案',
        math: `切點: (${tangentPoint.x.toFixed(2)}, ${tangentPoint.y.toFixed(2)}) <br> 方程式: ${tangentEq}`,
        explanation: `將 a = ${answerA} 代回 f'(a) 求斜率，並寫出切線方程式。`
    });

    return steps;
}

// ===== Q 點滑動動畫 =====
function startSliderAnimation(bounds) {
    if (sliderAnimationInterval) {
        clearInterval(sliderAnimationInterval);
    }
    
    const minA = bounds.left;
    const maxA = bounds.right;
    let currentA = minA;
    let direction = 1;
    const speed = (maxA - minA) / 200;
    
    sliderAnimationInterval = setInterval(() => {
        currentA += speed * direction;
        
        if (currentA >= maxA || currentA <= minA) {
            direction *= -1;
        }
        
        calculator.setExpression({
            id: 'slider-a',
            latex: `a=${currentA}`
        });
    }, 50);
}

function stopSliderAnimation() {
    if (sliderAnimationInterval) {
        clearInterval(sliderAnimationInterval);
        sliderAnimationInterval = null;
    }
}

// ===== 教學模式控制 =====
function showTutorial() {
    if (currentResults.length === 0) return;
    
    const { bounds } = visualize(currentFunction, currentPoint.x, currentPoint.y, true);
    
    const firstResult = currentResults[0];
    tutorialSteps = generateDetailedTutorialSteps(
        currentFunction, 
        currentPoint.x, 
        currentPoint.y, 
        firstResult.point
    );
    currentStepIndex = 0;
    
    calculator.setExpression({
        id: 'ghost-point',
        latex: `Q=(a,${currentFunction.replace(/x/g, 'a')})`,
        color: COLORS.ghost,
        pointSize: 11,
        label: 'Q',
        showLabel: true,
        labelSize: Desmos.LabelSizes.LARGE
    });
    
    calculator.setExpression({
        id: 'slider-a',
        latex: `a=${firstResult.point.t}`
    });
    
    startSliderAnimation(bounds);
    
    const overlay = document.getElementById('tutorialOverlay');
    overlay.classList.add('active');
    
    updateTutorialStep();
}

function updateTutorialStep() {
    const step = tutorialSteps[currentStepIndex];
    
    document.getElementById('tutorialTitle').textContent = step.title;
    document.getElementById('tutorialSubtitle').textContent = step.subtitle;
    
    const mathDisplay = document.getElementById('mathDisplay');
    mathDisplay.style.opacity = '0';
    mathDisplay.style.transform = 'translateY(10px)';
    
    setTimeout(() => {
        mathDisplay.innerHTML = step.math;
        mathDisplay.style.opacity = '1';
        mathDisplay.style.transform = 'translateY(0)';
    }, 150);
    
    document.getElementById('explanationText').textContent = step.explanation;
    
    const dotsContainer = document.getElementById('progressDots');
    dotsContainer.innerHTML = '';
    tutorialSteps.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.className = `dot ${index === currentStepIndex ? 'active' : ''}`;
        dotsContainer.appendChild(dot);
    });
    
    document.getElementById('prevStep').disabled = currentStepIndex === 0;
    document.getElementById('nextStep').disabled = currentStepIndex === tutorialSteps.length - 1;
}

function closeTutorial() {
    document.getElementById('tutorialOverlay').classList.remove('active');
    stopSliderAnimation();
    calculator.removeExpression({ id: 'ghost-point' });
    calculator.removeExpression({ id: 'slider-a' });
    visualize(currentFunction, currentPoint.x, currentPoint.y, false);
}

// ===== UI 互動 =====
function displayResults(results) {
    const resultsSection = document.getElementById('resultsSection');
    const resultsList = document.getElementById('resultsList');
    const errorSection = document.getElementById('errorSection');
    const showStepsBtn = document.getElementById('showStepsBtn');
    
    errorSection.style.display = 'none';
    resultsList.innerHTML = '';
    
    if (results.length === 0) {
        errorSection.style.display = 'block';
        document.getElementById('errorMessage').textContent = '找不到切線解';
        resultsSection.style.display = 'none';
        showStepsBtn.style.display = 'none';
        return;
    }
    
    results.forEach((result, index) => {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.innerHTML = `
            <span class="result-number">${index + 1}</span>
            <span>${formatEquation(result.slope, result.intercept)}</span>
        `;
        resultsList.appendChild(item);
    });
    
    resultsSection.style.display = 'block';
    showStepsBtn.style.display = 'block';
}

function calculate() {
    const funcStr = document.getElementById('functionInput').value.trim();
    const x0 = parseFloat(document.getElementById('pointX').value);
    const y0 = parseFloat(document.getElementById('pointY').value);
    
    if (!funcStr || isNaN(x0) || isNaN(y0)) {
        document.getElementById('errorSection').style.display = 'block';
        document.getElementById('errorMessage').textContent = '請輸入有效的函數與座標';
        return;
    }
    
    try {
        const { results } = visualize(funcStr, x0, y0, false);
        currentResults = results;
        currentFunction = funcStr;
        currentPoint = { x: x0, y: y0 };
        displayResults(results);
    } catch (error) {
        document.getElementById('errorSection').style.display = 'block';
        document.getElementById('errorMessage').textContent = error.message;
    }
}

// ===== 事件監聽 =====
document.addEventListener('DOMContentLoaded', () => {
    initDesmos();
    
    document.getElementById('calculateBtn').addEventListener('click', calculate);
    document.getElementById('showStepsBtn').addEventListener('click', showTutorial);
    document.getElementById('closeTutorial').addEventListener('click', closeTutorial);
    
    document.getElementById('prevStep').addEventListener('click', () => {
        if (currentStepIndex > 0) {
            currentStepIndex--;
            updateTutorialStep();
        }
    });
    
    document.getElementById('nextStep').addEventListener('click', () => {
        if (currentStepIndex < tutorialSteps.length - 1) {
            currentStepIndex++;
            updateTutorialStep();
        }
    });
    
    ['functionInput', 'pointX', 'pointY'].forEach(id => {
        document.getElementById(id).addEventListener('keypress', (e) => {
            if (e.key === 'Enter') calculate();
        });
    });
    
    setTimeout(calculate, 500);
});