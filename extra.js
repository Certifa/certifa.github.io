// Matrix Code Rain Effect
document.addEventListener('DOMContentLoaded', function() {
  const canvas = document.getElementById('matrix-canvas');
  
  // Only run if canvas exists (on homepage)
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  // Set canvas size
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = canvas.parentElement.offsetHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // Matrix characters - mix of numbers, letters, and symbols
  const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
  const charArray = chars.split('');
  
  const fontSize = 14;
  const columns = Math.floor(canvas.width / fontSize);
  
  // Array to track drop positions
  const drops = Array(columns).fill(1);
  
  // Colors - neon green with variations
  const colors = [
    'rgba(0, 255, 159, 0.9)',  // Bright neon green
    'rgba(0, 255, 159, 0.7)',
    'rgba(0, 255, 159, 0.5)',
    'rgba(0, 200, 130, 0.8)'
  ];
  
  function draw() {
    // Semi-transparent black to create fade effect
    ctx.fillStyle = 'rgba(10, 10, 10, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw characters
    ctx.font = `${fontSize}px monospace`;
    
    for (let i = 0; i < drops.length; i++) {
      // Random character
      const char = charArray[Math.floor(Math.random() * charArray.length)];
      
      // Random color from palette
      const color = colors[Math.floor(Math.random() * colors.length)];
      ctx.fillStyle = color;
      
      // Draw character
      const x = i * fontSize;
      const y = drops[i] * fontSize;
      ctx.fillText(char, x, y);
      
      // Reset drop randomly or when it reaches bottom
      if (y > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      
      // Move drop down
      drops[i]++;
    }
  }
  
  // Animation loop
  setInterval(draw, 50);
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});
