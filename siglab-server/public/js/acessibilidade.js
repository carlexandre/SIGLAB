document.addEventListener('DOMContentLoaded', () => {
    initAccessibility();
});

const DEFAULT_FONT_SIZE = 18;
const MAX_FONT_SIZE = 26;
const MIN_FONT_SIZE = 14;

function initAccessibility() {
    // Carregar preferências salvas
    const savedTheme = localStorage.getItem('y2k_theme');
    const savedFontSize = localStorage.getItem('y2k_font_size');

    // Aplicar Tema
    if (savedTheme) {
        document.body.classList.add(savedTheme);
        updateActiveButton(savedTheme);
    } else {
        updateActiveButton('default');
    }

    // Aplicar Tamanho da Fonte
    if (savedFontSize) {
        document.body.style.fontSize = `${savedFontSize}px`;
    }

    // Configurar Listeners dos Botões
    setupButtons();
}

function setupButtons() {
    // Botões de Fonte
    const btnAumentar = document.getElementById('btn-font-plus');
    const btnDiminuir = document.getElementById('btn-font-minus');

    if (btnAumentar) btnAumentar.addEventListener('click', () => changeFontSize(2));
    if (btnDiminuir) btnDiminuir.addEventListener('click', () => changeFontSize(-2));

    // Botões de Tema
    const btnThemeDefault = document.getElementById('btn-theme-default');
    const btnThemeContrast = document.getElementById('btn-theme-contrast');
    const btnThemeIce = document.getElementById('btn-theme-ice');

    if (btnThemeDefault) btnThemeDefault.addEventListener('click', () => setTheme('default'));
    if (btnThemeContrast) btnThemeContrast.addEventListener('click', () => setTheme('theme-contrast'));
    if (btnThemeIce) btnThemeIce.addEventListener('click', () => setTheme('theme-ice'));
}

/**
 * Altera o tamanho da fonte e salva
 * @param {number} delta - Quantidade de pixels para adicionar/remover
 */
function changeFontSize(delta) {
    const currentStyle = window.getComputedStyle(document.body, null).getPropertyValue('font-size');
    let currentSize = parseFloat(currentStyle);

    // Se por algum motivo não conseguir ler, usa o padrão
    if (isNaN(currentSize)) currentSize = DEFAULT_FONT_SIZE;

    let newSize = currentSize + delta;

    // Limites de segurança
    if (newSize > MAX_FONT_SIZE) newSize = MAX_FONT_SIZE;
    if (newSize < MIN_FONT_SIZE) newSize = MIN_FONT_SIZE;

    // Aplica e Salva
    document.body.style.fontSize = `${newSize}px`;
    localStorage.setItem('y2k_font_size', newSize);
}

/**
 * Troca o tema CSS e salva
 * @param {string} themeClass - Nome da classe CSS do tema ('theme-contrast', 'theme-ice', 'default')
 */

function setTheme(themeClass) {
    // Remove todos os temas conhecidos
    document.body.classList.remove('theme-contrast', 'theme-ice');

    // Se não for 'default', adiciona a nova classe
    if (themeClass !== 'default') {
        document.body.classList.add(themeClass);
        localStorage.setItem('y2k_theme', themeClass);
    } else {
        localStorage.removeItem('y2k_theme'); // Default não precisa salvar classe, apenas removemos a entry
    }

    updateActiveButton(themeClass);
}

// Função visual para destacar qual botão está ativo
function updateActiveButton(activeTheme) {
    // Remove classe 'active' de todos os botões de tema
    const buttons = document.querySelectorAll('.btn-access-theme');
    buttons.forEach(btn => {
        btn.style.opacity = '0.5';
        btn.style.fontWeight = 'normal';
        btn.style.boxShadow = 'none';
    });

    // Mapeamento de ID
    let btnId = 'btn-theme-default';
    if (activeTheme === 'theme-contrast') btnId = 'btn-theme-contrast';
    if (activeTheme === 'theme-ice') btnId = 'btn-theme-ice';

    const activeBtn = document.getElementById(btnId);
    if (activeBtn) {
        activeBtn.style.opacity = '1';
        activeBtn.style.fontWeight = 'bold';
        activeBtn.style.boxShadow = '0 0 5px currentColor';
    }
}