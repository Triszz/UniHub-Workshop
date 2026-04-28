# 📁 Sound Files for QR Scanner

## 🔊 Required Sound Files

Place these sound files in `assets/sounds/` folder:

### 1. `tic-tic.mp3` or `tic-tic.wav`
- **Duration**: ~0.3 seconds
- **Format**: MP3 or WAV
- **Content**: 2 quick beep sounds (tic-tic)
- **Volume**: Medium (not too loud)

## 🎵 How to Create Sound File

### Option 1: Online Sound Generator
1. Go to: https://www.bfxr.net/
2. Select "Pickup/Coin" preset
3. Adjust frequency to ~800Hz
4. Export as MP3

### Option 2: Use Free Sound
1. Download from: https://freesound.org/
2. Search for "beep" or "tic"
3. Choose short beep sound
4. Convert to MP3 if needed

### Option 3: Record Your Own
1. Use phone recorder
2. Make 2 quick "tic" sounds
3. Edit in Audacity (free)
4. Export as MP3

## 📱 File Structure
```
mobile/
  assets/
    sounds/
      tic-tic.mp3  ← Place your sound file here
```

## 🔧 Code Usage

The app will automatically:
- Load sound file on startup
- Play "tic-tic" when scanning QR
- Fallback to vibration if sound fails
- Work on both iOS and Android