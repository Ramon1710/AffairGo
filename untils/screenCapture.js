let activeProtectionCount = 0;
let removeWebProtection = null;
let blurResetTimer = null;

const ensureStyleSheet = () => {
	if (typeof document === 'undefined' || document.getElementById('affairgo-screen-capture-style')) {
		return;
	}

	const style = document.createElement('style');
	style.id = 'affairgo-screen-capture-style';
	style.textContent = `
		body.affairgo-capture-protected {
			-webkit-user-select: none;
			user-select: none;
			-webkit-touch-callout: none;
		}

		body.affairgo-capture-protected img {
			-webkit-user-drag: none;
		}

		body.affairgo-capture-obscured > * {
			filter: blur(16px) !important;
			pointer-events: none !important;
		}

		body.affairgo-capture-obscured::before {
			content: 'Geschützter Bereich';
			position: fixed;
			inset: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			background: rgba(10, 10, 14, 0.78);
			color: #fff;
			font: 700 20px/1.4 sans-serif;
			letter-spacing: 0.04em;
			z-index: 2147483647;
			pointer-events: none;
		}
	`;

	document.head.appendChild(style);
};

const setObscured = (active) => {
	if (typeof document === 'undefined') {
		return;
	}

	document.body.classList.toggle('affairgo-capture-obscured', active);
};

const obscureBriefly = () => {
	if (blurResetTimer) {
		clearTimeout(blurResetTimer);
	}

	setObscured(true);
	blurResetTimer = setTimeout(() => {
		blurResetTimer = null;
		if (activeProtectionCount > 0 && typeof document !== 'undefined' && !document.hidden) {
			setObscured(false);
		}
	}, 1600);
};

const installWebProtection = () => {
	if (typeof document === 'undefined' || removeWebProtection) {
		return;
	}

	ensureStyleSheet();
	document.body.classList.add('affairgo-capture-protected');

	const blockClipboardEvent = (event) => {
		event.preventDefault();
		obscureBriefly();
	};

	const handleKeydown = (event) => {
		const key = String(event.key || '').toLowerCase();
		const modifier = event.ctrlKey || event.metaKey;

		if (key === 'printscreen') {
			obscureBriefly();
			event.preventDefault();
			return;
		}

		if (modifier && ['p', 's', 'c', 'x'].includes(key)) {
			event.preventDefault();
			obscureBriefly();
		}
	};

	const handleVisibilityChange = () => {
		setObscured(document.hidden);
	};

	const handleBeforePrint = () => setObscured(true);
	const handleAfterPrint = () => setObscured(false);

	document.addEventListener('copy', blockClipboardEvent);
	document.addEventListener('cut', blockClipboardEvent);
	document.addEventListener('contextmenu', blockClipboardEvent);
	document.addEventListener('dragstart', blockClipboardEvent);
	document.addEventListener('keydown', handleKeydown, true);
	document.addEventListener('visibilitychange', handleVisibilityChange);
	window.addEventListener('beforeprint', handleBeforePrint);
	window.addEventListener('afterprint', handleAfterPrint);

	removeWebProtection = () => {
		document.removeEventListener('copy', blockClipboardEvent);
		document.removeEventListener('cut', blockClipboardEvent);
		document.removeEventListener('contextmenu', blockClipboardEvent);
		document.removeEventListener('dragstart', blockClipboardEvent);
		document.removeEventListener('keydown', handleKeydown, true);
		document.removeEventListener('visibilitychange', handleVisibilityChange);
		window.removeEventListener('beforeprint', handleBeforePrint);
		window.removeEventListener('afterprint', handleAfterPrint);
		document.body.classList.remove('affairgo-capture-protected');
		setObscured(false);
		removeWebProtection = null;
	};
};

export const preventScreenCaptureAsync = async () => {
	if (typeof document === 'undefined') {
		return;
	}

	activeProtectionCount += 1;
	installWebProtection();
};

export const allowScreenCaptureAsync = async () => {
	if (typeof document === 'undefined') {
		return;
	}

	activeProtectionCount = Math.max(0, activeProtectionCount - 1);

	if (activeProtectionCount === 0) {
		if (blurResetTimer) {
			clearTimeout(blurResetTimer);
			blurResetTimer = null;
		}

		removeWebProtection?.();
	}
};
