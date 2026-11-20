"""
Start-up: makes sure the one required library (Pillow) is installed, offering
to install it with pip if it is missing, then launches the game.
This file must not import Pillow at the top - it may not be installed yet.
"""
from __future__ import annotations

import importlib
import os
import site
import subprocess
import sys
import threading
import traceback

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _have(mod):
    try:
        importlib.import_module(mod)
        return True
    except Exception:
        return False


def _pip_install(packages):
    """Returns (ok, output)."""
    cmd = [sys.executable, '-m', 'pip', 'install', '--disable-pip-version-check', *packages]
    if not (hasattr(sys, 'real_prefix') or sys.prefix != getattr(sys, 'base_prefix', sys.prefix)):
        cmd.insert(4, '--user')
    kw = {}
    if sys.platform == 'win32':
        kw['creationflags'] = 0x08000000  # CREATE_NO_WINDOW
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=600, **kw)
        return p.returncode == 0, (p.stdout or '') + (p.stderr or '')
    except Exception as e:
        return False, str(e)


def _refresh_paths():
    try:
        usp = site.getusersitepackages()
        if usp and os.path.isdir(usp) and usp not in sys.path:
            sys.path.append(usp)
    except Exception:
        pass
    importlib.invalidate_caches()


def _installer_dialog():
    """Tiny plain-tk window shown only when Pillow is missing."""
    import tkinter as tk
    from tkinter import ttk

    result = {'ok': False}
    root = tk.Tk()
    root.title('Blackjack - one-time setup')
    root.configure(bg='#0d2416')
    root.resizable(False, False)
    w, h = 520, 270
    root.geometry(f'{w}x{h}+{(root.winfo_screenwidth() - w) // 2}+{(root.winfo_screenheight() - h) // 3}')
    tk.Label(root, text='♠  Blackjack needs one small library', font=('Segoe UI', 15, 'bold'),
             fg='#f2d07a', bg='#0d2416').pack(pady=(22, 8))
    msg = tk.Label(root, text='The game draws all of its cards, chips and table with "Pillow",\n'
                              'a free Python imaging library (about 3 MB).\n\n'
                              'Click Install to add it with pip, or run this yourself:\n'
                              'py -m pip install pillow',
                   font=('Segoe UI', 10), fg='#e9e2d0', bg='#0d2416', justify='center')
    msg.pack(pady=4)
    bar = ttk.Progressbar(root, mode='indeterminate', length=380)
    btns = tk.Frame(root, bg='#0d2416')
    btns.pack(pady=14)

    def done(ok, out):
        bar.stop()
        if ok:
            _refresh_paths()
            result['ok'] = True
            root.destroy()
        else:
            msg.configure(text='Installation failed.  Open a terminal and run:\n\n'
                               'py -m pip install pillow\n\nthen start the game again.', fg='#ffb4a8')
            bar.pack_forget()
            quit_btn.pack(side='left', padx=8)

    def install():
        install_btn.pack_forget()
        quit_btn.pack_forget()
        bar.pack(pady=4)
        bar.start(12)
        msg.configure(text='Installing Pillow... this usually takes under a minute.')

        def work():
            ok, out = _pip_install(['pillow'])
            root.after(0, lambda: done(ok, out))
        threading.Thread(target=work, daemon=True).start()

    install_btn = tk.Button(btns, text='Install', width=12, command=install, bg='#e9c46a', relief='flat',
                            font=('Segoe UI', 11, 'bold'))
    quit_btn = tk.Button(btns, text='Quit', width=10, command=root.destroy, bg='#3a3f47', fg='white',
                         relief='flat', font=('Segoe UI', 11))
    install_btn.pack(side='left', padx=8)
    quit_btn.pack(side='left', padx=8)
    root.mainloop()
    return result['ok']


def _fatal(text):
    try:
        with open(os.path.join(BASE, 'error_log.txt'), 'a', encoding='utf-8') as f:
            f.write(text + '\n')
    except Exception:
        pass
    try:
        import tkinter as tk
        from tkinter import messagebox
        r = tk.Tk()
        r.withdraw()
        messagebox.showerror('Blackjack', text[-1500:])
        r.destroy()
    except Exception:
        print(text)


def boot():
    # pythonw.exe (double-clicking a .pyw) has no console: give print() and
    # tracebacks somewhere harmless to go instead of crashing.
    if sys.stdout is None:
        sys.stdout = open(os.devnull, 'w')
    if sys.stderr is None:
        sys.stderr = open(os.devnull, 'w')
    if sys.version_info < (3, 7):
        _fatal('Blackjack needs Python 3.7 or newer.')
        return
    try:
        import tkinter  # noqa
    except Exception:
        print('This game needs tkinter (it ships with the normal python.org installer).')
        return
    if not _have('PIL'):
        if not _installer_dialog() or not _have('PIL'):
            # last resort: restart so a fresh interpreter sees the new package
            if _have('PIL'):
                pass
            else:
                return
    try:
        from .main import main
        main(BASE)
    except SystemExit:
        raise
    except Exception:
        _fatal('Blackjack crashed while starting:\n\n' + traceback.format_exc())
