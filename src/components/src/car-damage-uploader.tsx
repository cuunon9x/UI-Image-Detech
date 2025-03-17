import { Component, State, h } from '@stencil/core';

@Component({
  tag: 'car-damage-uploader',
  styleUrl: 'car-damage-uploader.css',
  shadow: true,
})
export class FileUpload {
  @State() predictions: any[] = [];
  @State() errorMessage: string = '';
  @State() imageUrl: string = '';
  private canvasRef: HTMLCanvasElement;

  private handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.uploadFile(file);
    }
  }

  private async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/predict/', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      this.predictions = data.predictions;
      this.errorMessage = '';
      this.imageUrl = URL.createObjectURL(file); // Create URL for the uploaded image
      this.loadImage(); // Load the image to get its dimensions
    } catch (error) {
      this.errorMessage = 'Error uploading file: ' + error.message;
      this.predictions = [];
    }
  }

  private loadImage() {
    const img = new Image();
    img.src = this.imageUrl;
    img.onload = () => {
      this.drawBoundingBoxes(img); // Draw bounding boxes after loading the image
    };
  }

  private drawBoundingBoxes(img: HTMLImageElement) {
    const canvas = this.canvasRef;
    const ctx = canvas.getContext('2d');

    // Set canvas size to match the image size
    canvas.width = img.width;
    canvas.height = img.height;

    // Clear the canvas and draw the image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Set font size and style for the bounding box labels
    ctx.font = 'bold 20px Arial'; // Change font size and style here
    ctx.textBaseline = 'top'; // Align text to the top of the bounding box

    // Draw bounding boxes
    this.predictions.forEach(prediction => {
      const x = prediction.x - prediction.width / 2; // Center the box
      const y = prediction.y - prediction.height / 2; // Center the box
      ctx.beginPath();
      ctx.rect(x, y, prediction.width, prediction.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(242, 78, 7, 0.87)';
      ctx.stroke();
      ctx.fillStyle = 'rgba(96, 250, 109, 0.87)';
      // ctx.fillText(`${prediction.label} - ${Math.round(prediction.confidence * 100)}%`, prediction.x, prediction.y > 10 ? prediction.y - 5 : 10);

      // Draw the label at the top-left corner of the bounding box
      this.drawWrappedText(ctx, `${prediction.label} ${Math.round(prediction.confidence * 100)}%`, x, y);
      ctx.closePath();
    });
  }
  // Function to draw wrapped text
  private drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number = 100) {
    const words = text.split(' ');
    let line = '';
    const lineHeight = 20; // Adjust line height as needed

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n] + ' ';
        y += lineHeight; // Move down for the next line
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y); // Draw the last line
  }

  render() {
    return (
      <div>
        <div class="header">This is test page to define car damage for ICO by TrinhCV</div>
        <div class="container">
          <h1>Car Damage Detection</h1>
          <input type="file" accept="image/*" onInput={event => this.handleFileUpload(event)} />
          {this.errorMessage && <p class="error">{this.errorMessage}</p>}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
            <canvas ref={el => (this.canvasRef = el as HTMLCanvasElement)}></canvas>
          </div>
        </div>
      </div>
    );
  }
}
