# -*- coding: utf-8 -*-
# Importa todo el codigo ST del repositorio al proyecto CODESYS abierto.
#
# Uso: abre el proyecto (plc/codesys/project/SmartFactory.project) y ejecuta
#      Herramientas > Scripting > Ejecutar archivo de script... > este archivo.
#
# Crea las carpetas 01_DUT ... 04_FB dentro de Application, crea (o actualiza)
# cada DUT, GVL, funcion y bloque de funcion, y reemplaza el contenido de PLC_PRG.
# Se puede ejecutar de nuevo: los objetos existentes se actualizan, no se duplican.
from __future__ import print_function
import os
import re
import codecs

ORDER = [
    ("01_DUT", "dut"),
    ("02_GVL", "gvl"),
    ("03_FUN", "pou"),
    ("04_FB", "pou"),
    ("05_PRG", "pou"),
]


def find_src_dir():
    """Busca la carpeta plc/codesys a partir del script o del proyecto."""
    candidates = []
    try:
        candidates.append(os.path.dirname(os.path.abspath(__file__)))
    except NameError:
        pass
    proj_path = projects.primary.path
    if proj_path:
        candidates.append(os.path.dirname(os.path.dirname(proj_path)))
    for c in candidates:
        if os.path.isdir(os.path.join(c, "01_DUT")):
            return c
    raise Exception("No encuentro la carpeta 01_DUT. Guarda el proyecto en "
                    "plc/codesys/project/ o ejecuta el script desde plc/codesys/.")


def read(path):
    with codecs.open(path, "r", "utf-8") as f:
        return f.read().replace("\r\n", "\n")


def split_pou(text):
    """Declaracion = todo hasta el ultimo END_VAR; implementacion = el resto."""
    matches = list(re.finditer(r"^\s*END_VAR\s*$", text, re.MULTILINE))
    if not matches:
        return text.strip(), ""
    cut = matches[-1].end()
    return text[:cut].rstrip(), text[cut:].strip("\n")


def find_child(container, name):
    for child in container.get_children(False):
        if child.get_name() == name:
            return child
    return None


def find_anywhere(app, name):
    found = app.find(name, True)
    return found[0] if found else None


def get_folder(app, name):
    folder = find_child(app, name)
    if folder is None:
        try:
            app.create_folder(name)
            folder = find_child(app, name)
        except Exception:
            folder = None
    return folder if folder is not None else app


def create_in(container, app, kind, name, header):
    """Crea el objeto en la carpeta; si la carpeta no lo admite, en Application."""
    for target in (container, app):
        try:
            if kind == "dut":
                dut_type = DutType.Enumeration if name.startswith("E_") else DutType.Structure
                return target.create_dut(name, dut_type)
            if kind == "gvl":
                return target.create_gvl(name)
            if header.startswith("FUNCTION_BLOCK"):
                return target.create_pou(name, PouType.FunctionBlock)
            if header.startswith("FUNCTION"):
                return target.create_pou(name, PouType.Function, return_type="BOOL")
            return target.create_pou(name, PouType.Program)
        except Exception as e:
            last = e
    raise last


def main():
    src = find_src_dir()
    proj = projects.primary
    apps = proj.find("Application", True)
    if not apps:
        raise Exception("El proyecto no tiene un objeto 'Application'.")
    app = apps[0]

    created, updated = [], []
    for folder_name, kind in ORDER:
        folder_path = os.path.join(src, folder_name)
        files = sorted(f for f in os.listdir(folder_path) if f.endswith(".st"))
        # GVL_Param primero: los demas usan sus constantes
        files.sort(key=lambda f: (f != "GVL_Param.st", f))
        container = app if folder_name == "05_PRG" else get_folder(app, folder_name)

        for file_name in files:
            name = file_name[:-3]
            text = read(os.path.join(folder_path, file_name))
            m = re.search(r"^\s*(FUNCTION_BLOCK|FUNCTION|PROGRAM)\b", text, re.MULTILINE)
            header = m.group(1) if m else ""

            obj = find_anywhere(app, name)
            if obj is None:
                obj = create_in(container, app, kind, name, header)
                created.append(name)
            else:
                updated.append(name)

            if kind == "pou":
                decl, impl = split_pou(text)
                obj.textual_declaration.replace(decl)
                obj.textual_implementation.replace(impl)
            else:
                obj.textual_declaration.replace(text.strip("\n"))
            print("OK  " + folder_name + "/" + name)

    print("")
    print("Creados: %d   Actualizados: %d" % (len(created), len(updated)))
    print("Siguiente paso: Compilar > Generar codigo (F11).")


main()
