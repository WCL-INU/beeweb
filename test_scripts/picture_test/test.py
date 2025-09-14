import requests

# 파일과 메타데이터 정보
files = {
    'file1': ('image1.jpg', open('./1.jpg', 'rb'), 'image/jpeg'),
    'file2': ('image2.jpg', open('./2.jpg', 'rb'), 'image/jpeg'),
    'file3': ('image3.jpg', open('./3.jpg', 'rb'), 'image/jpeg'),
    'file4': ('image4.jpg', open('./4.jpg', 'rb'), 'image/jpeg'),
    'file5': ('image5.jpg', open('./5.jpg', 'rb'), 'image/jpeg'),
    'file6': ('image6.jpg', open('./6.jpg', 'rb'), 'image/jpeg'),
    'file7': ('image7.jpg', open('./7.jpg', 'rb'), 'image/jpeg'),
}

metadata = {
    'type': '1',
    'file1_id': '1',
    'file1_time': '2024-10-03T10:10:10',
    'file2_id': '1',
    'file2_time': '2024-10-03T10:11:10',
    'file3_id': '1',
    'file3_time': '2024-10-03T10:12:10',
    'file4_id': '1',
    'file4_time': '2024-10-03T10:13:10',
    'file5_id': '1',
    'file5_time': '2024-10-03T10:14:10',
    'file6_id': '1',
    'file6_time': '2024-10-03T10:15:10',
    'file7_id': '1',
    'file7_time': '2024-10-03T10:16:10',
}

# 서버 URL
url = 'http://127.0.0.1:8082/api/upload'

# 멀티파트 폼 데이터 요청 보내기
response = requests.post(url, files={
    'file1': files['file1'],
    'file1_id': (None, metadata['file1_id']),
    'file1_time': (None, metadata['file1_time']),
    'file2': files['file2'],
    'file2_id': (None, metadata['file2_id']),
    'file2_time': (None, metadata['file2_time']),
    'file3': files['file3'],
    'file3_id': (None, metadata['file3_id']),
    'file3_time': (None, metadata['file3_time']),
    'file4': files['file4'],
    'file4_id': (None, metadata['file4_id']),
    'file4_time': (None, metadata['file4_time']),
    'file5': files['file5'],
    'file5_id': (None, metadata['file5_id']),
    'file5_time': (None, metadata['file5_time']),
    'file6': files['file6'],
    'file6_id': (None, metadata['file6_id']),
    'file6_time': (None, metadata['file6_time']),
    'file7': files['file7'],
    'file7_id': (None, metadata['file7_id']),
    'file7_time': (None, metadata['file7_time']),
}, data={
    'type': metadata['type']
})

# 응답 확인
print('Status code:', response.status_code)
print('Response body:', response.text)