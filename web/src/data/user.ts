import type { Notification, UserProfile } from '@/types';

export const notifications: Notification[] = [
  { id: 1, title: 'New Episode Available', message: 'Stranger Things S4 E9 is now streaming', time: '2 min ago', read: false, thumbnail: 'https://m.media-amazon.com/images/M/MV5BMDZkYmVhNjUtNWU4MS00ZDg5LWE3NjMtZTFmOWRlYzQ3NmM0XkEyXkFqcGc@._V1_.jpg', type: 'new_release' },
  { id: 2, title: 'Continue Watching', message: 'Pick up where you left off in The Batman', time: '1h ago', read: false, thumbnail: 'https://m.media-amazon.com/images/M/MV5BM2MyNTAwODEyNy00MDA5LTk2Y2YtYzE0Y2M1Y2M1Y2M1XkEyXkFqcGc@._V1_.jpg', type: 'reminder' },
  { id: 3, title: 'Recommended For You', message: 'Based on your watch history: Dune Part Two', time: '3h ago', read: true, thumbnail: 'https://m.media-amazon.com/images/M/MV5BNzAwNDUzNDY0M15BMl5BanBnXkFtZTcwODk3MzEyMw@@._V1_.jpg', type: 'recommendation' },
  { id: 4, title: 'New Release', message: 'Furiosa: A Mad Max Saga is now available', time: '1d ago', read: true, thumbnail: 'https://m.media-amazon.com/images/M/MV5BMDQ1NDMwNDItNDE4My00YTA5LWEwNmMtOWU5YzZlZGU2ZmJkXkEyXkFqcGc@._V1_.jpg', type: 'new_release' },
];

export const currentUser: UserProfile = {
  id: 1,
  name: 'Alex Chen',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
  email: 'alex.chen@example.com',
  plan: 'premium',
  joinDate: '2022-03-15',
};

export const myListIds = ['tt1375666', 'tt0468569', 'tt0903747', 'tt0816692', 'tt0111161'];

export const continueWatchingIds = [
  { id: 'tt10872600', progress: 45 },
  { id: 'tt0468569', progress: 62 },
];
