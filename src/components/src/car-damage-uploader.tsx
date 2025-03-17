import { Component, State, h } from '@stencil/core';
import heic2any from 'heic2any';

@Component({
  tag: 'car-damage-uploader',
  styleUrl: 'car-damage-uploader.css',
  shadow: true,
})
export class FileUpload {
  @State() predictions: any[] = [];
  @State() errorMessage: string = '';
  @State() imageUrl: string = '';
  @State() isCameraActive: boolean = false;
  @State() isLoading: boolean = false;
  @State() useRearCamera: boolean = false;
  @State() showCamera: boolean = true;
  private canvasRef: HTMLCanvasElement;
  private videoRef: HTMLVideoElement;

  private async handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      let file = input.files[0];

      const heicType = file.name.endsWith('.HEIC') || file.name.endsWith('.heic');
      if (file.type === 'image/heic' || heicType) {
        try {
          const convertedBlob = (await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.8,
          })) as Blob;

          file = new File([convertedBlob], file.name.replace('.HEIC', '.jpg'), {
            type: 'image/jpeg',
          });
        } catch (error) {
          this.errorMessage = 'Error converting HEIC file.';
          return;
        }
      }

      this.uploadFile(file);
    }
  }

  private async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    try {
      this.isLoading = true;
      const response = await fetch('https://imagedetech.onrender.com/predict/', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        this.isLoading = false;
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      this.predictions = data.predictions;
      this.errorMessage = '';
      this.imageUrl = URL.createObjectURL(file);
      this.isLoading = false;
      this.loadImage();
    } catch (error) {
      this.errorMessage = 'Error uploading file: ' + error.message;
      this.predictions = [];
    }
  }

  private toggleCamera() {
    this.useRearCamera = !this.useRearCamera;
    this.startCamera();
  }

  private resetPage() {
    this.predictions = [];
    this.errorMessage = '';
    this.imageUrl = '';
    this.isCameraActive = false;
    this.canvasRef.style.display = 'none';
    this.isLoading = false;
    this.stopCamera();
    if (this.videoRef && this.videoRef.srcObject) {
      const stream = this.videoRef.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      this.videoRef.srcObject = null;
    }
  }

  private loadImage() {
    const img = new Image();
    img.src = this.imageUrl;
    img.onload = () => {
      this.drawBoundingBoxes(img);
    };
    this.canvasRef.style.display = 'block';
  }

  private drawBoundingBoxes(img: HTMLImageElement) {
    const canvas = this.canvasRef;
    const ctx = canvas.getContext('2d');

    canvas.width = img.width;
    canvas.height = img.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    ctx.font = 'bold 16px Arial';
    ctx.textBaseline = 'top';

    if (this.predictions.length === 0 || this.predictions.every(prediction => prediction.confidence * 100 < 60)) {
      ctx.fillStyle = 'red';
      ctx.fillText('Image not recognized', canvas.width / 2 - 50, canvas.height / 2);
    } else {
      this.predictions.forEach(prediction => {
        const x = prediction.x - prediction.width / 2;
        const y = prediction.y - prediction.height / 2;
        ctx.beginPath();
        ctx.rect(x, y, prediction.width, prediction.height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(242, 78, 7, 0.87)';
        ctx.stroke();
        ctx.fillStyle = 'rgba(96, 250, 109, 0.87)';
        this.drawWrappedText(ctx, `${prediction.label} ${Math.round(prediction.confidence * 100)}%`, x, y);
        ctx.closePath();
      });
    }
  }

  private drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number = 100) {
    const words = text.split(' ');
    let line = '';
    const lineHeight = 20;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
  }

  private startCamera() {
    this.isCameraActive = true;
    this.showCamera = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: this.useRearCamera ? 'environment' : 'user' } })
      .then(stream => {
        this.videoRef.srcObject = stream;
        this.videoRef.play();
      })
      .catch(error => {
        console.error('Error accessing camera:', error);
        this.errorMessage = 'Failed to access camera';
      });
  }

  private stopCamera() {
    if (this.videoRef && this.videoRef.srcObject) {
      const stream = this.videoRef.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      this.videoRef.srcObject = null;
      this.isCameraActive = false;
    }
  }

  private captureImage() {
    this.showCamera = false;
    const canvas = this.canvasRef;
    const ctx = canvas.getContext('2d');
    canvas.width = this.videoRef.videoWidth;
    canvas.height = this.videoRef.videoHeight;
    ctx.drawImage(this.videoRef, 0, 0, canvas.width, canvas.height);
    this.stopCamera();
    canvas.toBlob(blob => {
      if (blob) {
        this.uploadFile(new File([blob], 'capture.jpg', { type: 'image/jpeg' }));
      }
    }, 'image/jpeg');
  }

  render() {
    return (
      <div class="container">
        <header class="header">
          <h1>Car damage definitions for ICO testing, by TrinhCV.</h1>
        </header>
        <input type="file" class="file-input" accept="image/*" onInput={event => this.handleFileUpload(event)} />

        {this.isLoading && (
          <div class="loading">
            <div class="spinner"></div>
          </div>
        )}

        <button class="button start-camera" onClick={() => this.startCamera()}>
          Start Camera
        </button>

        {this.isCameraActive && this.showCamera && <video class="video" ref={el => (this.videoRef = el as HTMLVideoElement)} autoplay playsinline></video>}
        {this.isCameraActive && (
          <button class="button toggle-camera" onClick={() => this.toggleCamera()}>
            Use Camera
          </button>
        )}
        {this.isCameraActive && (
          <button class="button capture-image" onClick={() => this.captureImage()}>
            Capture Image
          </button>
        )}

        <button class="button reset-page" onClick={() => this.resetPage()}>
          Reset Page
        </button>

        {this.errorMessage && <p class="error">{this.errorMessage}</p>}
        <canvas class="canvas" ref={el => (this.canvasRef = el as HTMLCanvasElement)}></canvas>
      </div>
    );
  }
}
