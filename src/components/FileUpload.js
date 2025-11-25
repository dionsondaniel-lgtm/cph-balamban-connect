import React, { useState } from 'react';
c
import './FileUpload.css';

export default function FileUpload() {
  const [file, setFile] = useState(null);

  const uploadFile = async () => {
    if (!file) return;
    const { data, error } = await supabase.storage
      .from('patient-files')
      .upload(file.name, file);

    if (error) console.log(error);
    else alert('Upload successful');
  };

  return (
    <div className="upload-container">
      <input type="file" onChange={e => setFile(e.target.files[0])} />
      <button onClick={uploadFile}>Upload</button>
    </div>
  );
}
