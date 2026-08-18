# Music Track Studio

Sequenciador musical experimental no navegador para compor uma música por seções e pistas independentes.

## O que já existe

- Estrutura completa: Intro, Verse, Chorus, Bridge e Outro.
- Três pistas por seção: guitarra, baixo e bateria (15 pistas lógicas no arranjo).
- Sequenciador de 16 passos por pista.
- Guitarra em power chords sintetizados (raiz + quinta + oitava) com timbres Modern, Crunch e Clean.
- Baixo em camadas de sub + corpo, com padrões Raiz, Raiz + quinta e Raiz + oitava.
- Bateria procedural com kick, snare, hi-hat, open hat e crash em síntese dedicada.
- Presets Rock, Metal, Punk, Half-time e Djent.
- Reprodução de uma seção isolada ou da música inteira.
- Compressor no master bus.
- Salvamento local no navegador via localStorage.

## Rodar localmente

```bash
python -m http.server 8080
```

Abra `http://localhost:8080`.

## Próximas evoluções sugeridas

- Piano roll real com duração e velocity.
- Acordes além de power chords.
- Viradas de bateria e fills automáticos entre seções.
- Mixer com volume/pan/mute/solo por pista.
- Samples reais opcionais e soundfonts.
- Exportação MIDI e renderização WAV/stems.
