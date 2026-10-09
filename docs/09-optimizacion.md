# 9. Optimización: piezas por minuto

El 15 % de la nota mide la **eficiencia de ciclo**. Este análisis explica qué limita la producción,
cómo se aprovecha al máximo y qué palancas quedan para ajustar en la escena real.

## 9.1 Dónde está el cuello de botella

La regla del jurado alterna tapas y bases para cada color, así que **la mitad de las piezas va a
cada centro de mecanizado**. MC1 tarda más (tapa ≈ 6 s de mecanizado) que MC2 (base ≈ 3 s), por lo
que **MC1 limita la celda**:

```
ciclo MC1 = carga + mecanizado de tapa + descarga
máximo de la celda = 2 × 60 / ciclo MC1      (por cada tapa entra también una base)
```

Con los tiempos del gemelo digital (carga 1,2 s, tapa 6 s, descarga 1,2 s → ciclo 8,4 s) el
máximo teórico es **14,3 productos por minuto**. El tablero calcula este límite en vivo con el
ciclo real medido (`GVL_HMI.rCycleMC1_s`) y lo muestra junto a la ocupación de cada máquina.

## 9.2 Resultado del gemelo digital

Diez minutos en régimen, después de un minuto de arranque:

| Configuración | Productos/min | Ocupación MC1 | Ocupación MC2 | Errores |
|---|---|---|---|---|
| **Parámetros por defecto** | **14,2** (99 % del máximo) | 96,5 % | 62,9 % | 0 |
| Sin pulmón en las ramas (`iBranchCapacity = 1`) | 11,5 | 77,2 % | 49,6 % | 0 |
| Pulmón mayor (`iBranchCapacity = 5`) | 14,4 | 96,5 % | 64,5 % | 0 |
| Poco inventario en M3 (`iMainCapacity = 2`) | 10,9 | 73,5 % | 47,8 % | 0 |
| Separación doble en la unión (`tMergeGap = 3 s`) | 14,4 | 96,5 % | 62,5 % | 0 |
| Ruedas más lentas (`tSorterSettle = 0,8 s`) | 14,3 | 96,5 % | 62,8 % | 0 |

Lectura: con los valores por defecto la celda trabaja **al ritmo de su máquina más lenta**. Lo
que más castiga es dejar a MC1 sin pieza esperando: por eso existe el pulmón de 3 piezas en cada
rama y por eso la faja principal admite hasta 5 piezas.

## 9.3 Qué hace el programa para no perder ciclo

| Medida | Efecto |
|---|---|
| Pulmón por rama (`iBranchCapacity`) y acumulación en M4/M5 | MC1 siempre tiene la siguiente pieza en la bahía al terminar |
| Retención en el punto de lectura en vez de en la rama | Si una rama está llena, la pieza espera en M3 sin bloquear a la otra máquina más de lo necesario |
| Orientación de ruedas antes de que llegue la pieza | El sorter entrega en menos de 1 s |
| Fajas por demanda con marcha residual (`tRunOn`) | Ahorro de energía sin frenar el flujo |
| Turno alterno en la unión | Las dos fajas alimentan por igual: ninguna máquina se queda sin un color |
| Retención de M6/M8 solo durante el empuje del verde | El azul sigue de largo sin paradas |

## 9.4 Palancas en la escena real

1. **Mide el ciclo real de MC1** (`rCycleMC1_s`) en Factory I/O: es el número que manda.
2. Si MC1 queda por debajo del 90 % de ocupación, sube `iBranchCapacity` o acorta `tMergeGap`.
3. Si el sorter genera la alarma 12, sube `tSorterTimeout` antes de tocar la lógica.
4. Graba el video con la celda ya en régimen (2 minutos produciendo) para que el KPI refleje el ritmo real.

> Una mejora fuera de las reglas actuales sería repartir más piezas a MC2 (la máquina rápida),
> pero la observación del jurado fija la alternancia por color. Se respeta la regla y se exprime el
> ritmo de MC1.
